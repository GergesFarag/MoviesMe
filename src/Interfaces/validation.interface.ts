export interface IJSONValidator {
    validateJSON: (jsonString: string) => boolean;
    sanitizeJSON: (jsonString: string) => string;
    fixCommonJSONIssues: (jsonString: string) => string;
}
export interface IValidator{
    JSONValidator: IJSONValidator;
    // SchemaValidator: any;
    // InputSanitizer: any;
    // BusinessValidator: any;
}