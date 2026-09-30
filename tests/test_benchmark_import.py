import copy
import importlib.util
import io
import json
import pathlib
import re
import tempfile
import unittest
import zipfile
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('benchmark_import', pathlib.Path(__file__).parents[1] / 'scripts/import-benchmark-seasons.py')
importer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(importer)


def voltaic(season):
    return {'alias': 'aimlabs_' + season, 'season': season[1:],
            'tiers': [{'id': 1, 'name': 'Novice'}],
            'categories': [{'name': 'clicking', 'subcategories': [{'id': 1, 'name': 'static'}]}],
            'ranks': [{'name': 'iron', 'tier_id': 1, 'energy_threshold': 100}],
            'scenarios': [{'task_id': season + '-task', 'weapon_id': 'benchmark-weapon', 'task_mode': 42,
                           'subcategory_id': 1, 'tiers': [{'tier_id': 1, 'thresholds': [100, 200, 300, 400]}]}]}


class BenchmarkImportTests(unittest.TestCase):
    def package(self):
        result = io.BytesIO()
        with zipfile.ZipFile(result, 'w') as archive:
            archive.writestr('fixture_Playlist.json', json.dumps({'playlist': [
                {'csContentId': 'ra-task', 'taskName': 'RA Fixture', 'taskWeapon': 'ra-weapon', 'publishFileId': 42, 'taskMode': 0}
            ]}))
        return result.getvalue()

    def sources(self, url, payload=None):
        if 'voltaic.gg' in url:
            return voltaic(url.rsplit('_', 1)[1])
        return {'sections': [{'id': 'benchmark-aim-training', 'minorSections': [{'id': 'benchmark-playlists', 'links': [
            {'text': 'S4 ' + level, 'href': 'https://example.invalid?id=123'} for level in ['easy', 'medium', 'hard']
        ]}]}]}

    def graphql(self, query, variables=None):
        if 'Playlist(' in query:
            return {'aimlabPlaylistsByWorkshop': [{'name': 'RA', 'asset': {'signedUrl': 'https://example.invalid/temporary-secret'}}]}
        tasks = re.findall(r'(t\d+): task\(slug:("[^"]+")\)', query)
        return {'aimlab': {key: {'id': json.loads(slug), 'name': 'Fixture', 'weapon_id': 'metadata-weapon',
                               'mode': 42, 'version': 3, 'duration': 60, 'author': {'username': 'Creator'}} for key, slug in tasks}}

    def test_import_retains_canonical_thresholds_task_identity_and_mode_without_signed_urls(self):
        with tempfile.TemporaryDirectory() as folder, patch.object(importer, 'ROOT', pathlib.Path(folder)), \
                patch.object(importer, 'request_json', self.sources), patch.object(importer, 'graphql', self.graphql), \
                patch.object(importer.urllib.request, 'urlopen', lambda *args, **kwargs: io.BytesIO(self.package())):
            importer.import_definitions()
            vt = json.loads((pathlib.Path(folder) / 'voltaic-s3.json').read_text())
            ra = json.loads((pathlib.Path(folder) / 'revosect-s4.json').read_text())
            self.assertEqual(vt['scenarios'][0]['tiers'][0]['thresholds'], [100, 200, 300, 400])
            self.assertEqual(vt['scenarios'][0]['weapon_id'], 'benchmark-weapon')
            self.assertEqual(vt['scenarios'][0]['task_mode'], 42)
            self.assertEqual(vt['scenarios'][0]['taskMetadata']['id'], 's3-task')
            self.assertEqual(ra['levels']['easy']['scenarios'][0]['weapon'], 'ra-weapon')
            self.assertEqual(ra['levels']['easy']['scenarios'][0]['taskMode'], 0)
            self.assertFalse(ra['rankingAvailable'])
            self.assertNotIn('temporary-secret', json.dumps(ra))

    def test_failed_late_provider_step_leaves_all_previous_files_intact(self):
        with tempfile.TemporaryDirectory() as folder:
            root = pathlib.Path(folder)
            for filename in ['voltaic-s2.json', 'voltaic-s3.json', 'revosect-s4.json']:
                (root / filename).write_text('previous-' + filename)
            before = {p.name: p.read_bytes() for p in root.iterdir()}
            def fail_late(query, variables=None):
                if 'Playlist(' in query:
                    raise ValueError('Provider failed')
                return self.graphql(query, variables)
            with patch.object(importer, 'ROOT', root), patch.object(importer, 'request_json', self.sources), patch.object(importer, 'graphql', fail_late):
                with self.assertRaisesRegex(ValueError, 'Provider failed'):
                    importer.import_definitions()
            self.assertEqual({p.name: p.read_bytes() for p in root.iterdir()}, before)

    def test_invalid_thresholds_groups_and_modes_are_rejected(self):
        for mutate in [lambda data: data['scenarios'][0].update(task_mode=0),
                       lambda data: data['scenarios'][0].update(subcategory_id=99),
                       lambda data: data['scenarios'][0]['tiers'][0].update(thresholds=[100, 200, 200, 400]),
                       lambda data: data['scenarios'].clear()]:
            data = copy.deepcopy(voltaic('s3'))
            mutate(data)
            with self.assertRaises(ValueError):
                importer.validate_voltaic(data)

    def test_mismatched_task_metadata_is_rejected(self):
        with patch.object(importer, 'graphql', lambda *args: {'aimlab': {'t0': {'id': 'different-task'}}}):
            with self.assertRaisesRegex(ValueError, 'did not resolve'):
                importer.metadata([{'task_id': 'expected-task'}])
