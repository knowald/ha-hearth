import home from '../../../../static/translations/en.json';
import hearth from '../../../../static/translations/hearth/en.json';

/**
 * All English copy, Home Assistant's strings and Hearth's own, for tests that
 * look up the text a user sees. Runtime code gets its copy from the server.
 */
export const english = { ...home, ...hearth };
