export function takeInitialResponse(component, path) {
  const result = component.initialResponses[path];
  delete component.initialResponses[path];
  return result;
}
