import * as os from 'node:os'

import type { DataCache } from '@contentlayer/core'
import * as core from '@contentlayer/core'
import { Chunk, OT, pipe, S, T } from '@contentlayer/utils/effect'

import { fetchDatabasePages } from '../notion/fetchDatabasePages.js'
import type { DatabaseTypeDef } from '../schema/types/database.js'
import { makeCacheItem } from './makeCacheItem.js'

export type FetchAllDocumentsArgs = {
  databaseTypeDefs: DatabaseTypeDef[]
  previousCache: core.DataCache.Cache | undefined
  schemaDef: core.SchemaDef
  options: core.PluginOptions
}

export const fetchAllDocuments = ({ databaseTypeDefs, previousCache, schemaDef, options }: FetchAllDocumentsArgs) =>
  pipe(
    T.forEachPar_(databaseTypeDefs, (databaseTypeDef) =>
      pipe(
        fetchDatabasePages({ databaseTypeDef }),
        S.chain((pages) =>
          pipe(
            S.effect(
              pipe(
                T.forEachParN_(pages, os.cpus().length, (page) =>
                  makeCacheItem({
                    page,
                    documentTypeDef: schemaDef.documentTypeDefMap[databaseTypeDef.name]!,
                    databaseTypeDef,
                    previousCache,
                    options,
                  }),
                ),
              ),
            ),
            OT.withStreamSpan('@contentlayer/source-notion/fetchData:makeCacheItems'),
          ),
        ),
        S.runCollect,
        T.chain((chunks) =>
          T.reduce_(chunks, [] as { fromCache: boolean; cacheItem: DataCache.CacheItem }[], (z, a) =>
            T.succeed([...z, ...a]),
          ),
        ),
      ),
    ),
    T.map((chunks) =>
      Chunk.reduce_(chunks, [] as { fromCache: boolean; cacheItem: DataCache.CacheItem }[], (z, a) => [...z, ...a]),
    ),
    T.map((documents) => ({
      cacheItemsMap: Object.fromEntries(documents.map((_) => [_.cacheItem.document._id, _.cacheItem])),
    })),
    OT.withSpan('@contentlayer/source-notion/fetchData:fetchAllDocuments'),
    T.mapError((error) => new core.SourceFetchDataError({ error, alreadyHandled: false })),
  )
