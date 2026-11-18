export const routerRoleEvent = 'workbench:router-role';

// Pi isolates extension module imports. Request the registered router through the
// session event bus instead of mutating a separately imported module instance.
export function requestRouterRole(pi, role) {
  const request = { role, effectiveRole: null, error: null };
  pi.events.emit(routerRoleEvent, request);
  if (request.error) throw new Error(request.error);
  if (request.effectiveRole !== role) throw new Error('Router extension unavailable or role update unconfirmed; enable the Workbench model-router extension.');
  return request.effectiveRole;
}
