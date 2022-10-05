export type ContentHistoryOptions = {
    maxLength: number;
}

export class ContentHistory {
    maxLength: number;
    private _arr: any[];

    constructor(options: ContentHistoryOptions) {
        this.maxLength = options.maxLength | 8;
        this._arr = [];
    }

    push(elt: any) {
        this._arr.push(elt);
        this._arr.slice(-this.maxLength);
    }

    list() {
        return this._arr;
    }
}