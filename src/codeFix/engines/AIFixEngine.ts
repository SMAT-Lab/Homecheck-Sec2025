import { ArkFile } from "arkanalyzer";
import { FileReports, IssueReport } from "../../model/Defects";
import { Engine } from "../../model/Engine";
import Logger, { LOG_MODULE_TYPE } from "arkanalyzer/lib/utils/logger";

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'EsLintFixEngine');

export class AIFixEngine implements Engine {
    applyFix(arkFile: ArkFile, isses: IssueReport[]): FileReports {
        logger.info('Todo implement.');
        throw TypeError('todo implement');
    }
}