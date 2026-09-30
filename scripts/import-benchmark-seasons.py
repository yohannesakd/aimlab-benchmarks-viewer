import io
import json
import pathlib
import time
import urllib.error
import urllib.request
import zipfile

ROOT = pathlib.Path(__file__).resolve().parents[1] / 'server' / 'benchmarks'
ENDPOINT = 'https://api.aimlabs.com/graphql'


def request_json(url, payload=None):
    request = urllib.request.Request(url, data=json.dumps(payload).encode() if payload else None,
                                     headers={'Content-Type': 'application/json', 'User-Agent': 'AimlabTrackerBenchmarkImport/1.0'})
    with urllib.request.urlopen(request, timeout=20) as response:
        body = response.read(1_000_001)
    if len(body) > 1_000_000:
        raise ValueError('Response exceeded import limit')
    return json.loads(body)


def graphql(query, variables=None):
    data = request_json(ENDPOINT, {'query': query, 'variables': variables or {}})
    time.sleep(1)
    if data.get('errors'):
        raise ValueError('Aimlabs rejected the import query')
    return data['data']['Trainer']


def metadata(scenarios):
    result = []
    for offset in range(0, len(scenarios), 8):
        batch = scenarios[offset:offset + 8]
        fields = 'id name weapon_id mode workshop_id duration version author { username }'
        selection = ' '.join('t' + str(i) + ': task(slug:' + json.dumps(s.get('task_id', s.get('id'))) + ') {' + fields + '}' for i, s in enumerate(batch))
        tasks = graphql('query {Trainer {aimlab {' + selection + '}}}')['aimlab']
        for i, scenario in enumerate(batch):
            task = tasks['t' + str(i)]
            expected = scenario.get('task_id', scenario.get('id'))
            if not task or task['id'] != expected:
                raise ValueError('Aimlabs did not resolve benchmark task ' + expected)
            result.append({**scenario, 'taskMetadata': task})
    return result


def validate_voltaic(data):
    tier_ids = {tier['id'] for tier in data['tiers']}
    subcategory_ids = {sub['id'] for category in data['categories'] for sub in category['subcategories']}
    for scenario in data['scenarios']:
        if scenario['subcategory_id'] not in subcategory_ids or scenario['task_mode'] != 42:
            raise ValueError('Unexpected Voltaic scenario group or mode')
        for tier in scenario['tiers']:
            scores = tier['thresholds']
            if tier['tier_id'] not in tier_ids or len(scores) != 4 or not all(a < b for a, b in zip([0] + scores, scores)):
                raise ValueError('Invalid Voltaic score thresholds')
    for tier_id in tier_ids:
        for subcategory_id in subcategory_ids:
            if not any(s['subcategory_id'] == subcategory_id and any(t['tier_id'] == tier_id for t in s['tiers']) for s in data['scenarios']):
                raise ValueError('Missing Voltaic subcategory')


def import_definitions():
    pending = {}
    today = time.strftime('%Y-%m-%d', time.gmtime())
    for season in ['s3', 's2']:
        url = 'https://app.voltaic.gg/api/v1/aimlabs/benchmarks/aimlabs_' + season
        data = request_json(url)
        validate_voltaic(data)
        pending['voltaic-' + season + '.json'] = {
            'id': data['alias'], 'community': 'voltaic', 'label': 'Season ' + data['season'] + ' (current definitions)',
            'source': url, 'retrievedAt': today, 'tiers': data['tiers'], 'categories': data['categories'],
            'ranks': [{'name': r['name'].capitalize(), 'tier_id': r['tier_id'], 'energy_threshold': r['energy_threshold']} for r in data['ranks']],
            'scenarios': metadata(data['scenarios']),
        }
    resources = request_json('https://revosect.com/api/resources')
    links = next(section for section in resources['sections'] if section['id'] == 'benchmark-aim-training')['minorSections']
    links = next(section for section in links if section['id'] == 'benchmark-playlists')['links']
    revosect = {'id': 'revosect_s4', 'community': 'revosect', 'label': 'Series 4', 'source': 'https://revosect.com/resources',
                'retrievedAt': today, 'rankingAvailable': False, 'levels': {}}
    for level in ['easy', 'medium', 'hard']:
        link = next(link for link in links if link['text'].lower() == 's4 ' + level)['href']
        workshop = link.split('id=', 1)[1]
        if not workshop.isdigit():
            raise ValueError('Invalid Revosect playlist ID')
        playlist = graphql('query Playlist($id: String!) {Trainer {aimlabPlaylistsByWorkshop(workshopId:$id) {name asset {signedUrl}}}}', {'id': workshop})['aimlabPlaylistsByWorkshop']
        if len(playlist) != 1 or not playlist[0]['asset']:
            raise ValueError('Expected one published Revosect playlist')
        with urllib.request.urlopen(playlist[0]['asset']['signedUrl'], timeout=20) as response:
            package = response.read(2_000_001)
        if len(package) > 2_000_000:
            raise ValueError('Playlist package exceeded import limit')
        with zipfile.ZipFile(io.BytesIO(package)) as archive:
            info = next(info for info in archive.infolist() if info.filename.endswith('_Playlist.json'))
            if info.file_size > 1_000_000:
                raise ValueError('Playlist exceeded import limit')
            tasks = json.loads(archive.read(info))['playlist']
        scenarios = [{'id': task['csContentId'], 'name': task['taskName'], 'weapon': task['taskWeapon'],
                      'workshopId': str(task['publishFileId']), 'taskMode': task['taskMode']} for task in tasks]
        if not 1 <= len(scenarios) <= 30 or any(s['taskMode'] != 0 for s in scenarios):
            raise ValueError('Unexpected Revosect playlist size or task mode')
        revosect['levels'][level] = {'playlistWorkshopId': workshop, 'scenarios': metadata(scenarios)}
    pending['revosect-s4.json'] = revosect
    for name, data in pending.items():
        target = ROOT / name
        temporary = target.with_suffix('.json.tmp')
        temporary.write_text(json.dumps(data, indent=2) + '\n')
        temporary.replace(target)
        print(name + ': imported verified task metadata')


if __name__ == '__main__':
    try:
        import_definitions()
    except urllib.error.HTTPError as error:
        print('Import stopped: upstream HTTP ' + str(error.code) + '. Existing definitions remain unchanged.')
        raise SystemExit(1)
    except urllib.error.URLError:
        print('Import stopped: upstream connection failed. Existing definitions remain unchanged.')
        raise SystemExit(1)
