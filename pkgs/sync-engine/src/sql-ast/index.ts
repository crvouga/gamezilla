export {
  type ClassifiedRead,
  type ClassifiedStatement,
  type ClassifiedWrite,
  classify,
  hasReturningClause,
  type SqlAstDialect,
  sqlTextForAst,
} from './classify';
export {
  createWriteCaptureBag,
  type WriteCaptureBag,
  type WriteCaptureSnapshot,
} from './write-capture';
