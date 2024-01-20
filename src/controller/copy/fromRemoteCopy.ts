import { AsyncResult, ErrorType, Ok } from "functional-extensions"
import { CopyItem } from "../../requests/requests"

export const copyInfoFromRemote = (_: string, __: string, items: CopyItem[]) => 
    AsyncResult.from(new Ok<CopyItem[], ErrorType>(
        items
            .filter(n => n.isDirectory))) 

