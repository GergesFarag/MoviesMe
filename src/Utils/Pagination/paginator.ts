const paginator = (data:any, page: number, limit: number) => {
    return data.slice((page - 1) * limit, page * limit);
}

export default paginator;
