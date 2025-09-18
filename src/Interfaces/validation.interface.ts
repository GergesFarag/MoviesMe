interface IJSONValidator {
    validateJSON: (jsonString: string) => boolean;
    sanitizeJSON: (jsonString: string) => string;
    fixCommonJSONIssues: (jsonString: string) => string;
}
interface IValidation{
    JSONValidator: IJSONValidator;
}