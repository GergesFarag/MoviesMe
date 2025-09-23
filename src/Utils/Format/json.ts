export const getJsonKey = (data:any, value:string) => {
    return Object.keys(data).find(key => data[key] === value);
}