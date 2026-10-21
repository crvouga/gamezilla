/**
 * The `service.name` the API reports on every signal. A metrics backend
 * stores it as the `job` label, so the objectives that read the API's
 * metrics select it by this same constant.
 */
export const SERVER_SERVICE_NAME = 'gamezilla-server';
