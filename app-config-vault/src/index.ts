import fetch from 'cross-fetch';
import { api, buildPath, setGlobalFetch } from '@lcdev/fetch';
import type { JsonObject } from '@lcdev/ts';
import type { Json } from '@app-config/utils';
import type { ParsingExtension } from '@app-config/core';
import { named, forKey, validateOptions } from '@app-config/extension-utils';

setGlobalFetch(fetch);

export interface Options {
  address?: string;
  token?: string;
  namespace?: string;
}

function vaultParsingExtension(options: Options = {}): ParsingExtension {
  const address = options.address ?? process.env.VAULT_ADDR ?? 'http://127.0.0.1:8200';
  const token = options.token ?? process.env.VAULT_TOKEN;
  const namespace = options.namespace ?? process.env.VAULT_NAMESPACE;

  const vaultApi = api(address).withTransform((builder) => {
    let call = builder;

    if (token) {
      call = call.withHeader('X-Vault-Token', token);
    }

    if (namespace) {
      call = call.withHeader('X-Vault-Namespace', namespace);
    }

    return call.expectStatus(200);
  });

  return named(
    '$vault',
    forKey(
      '$vault',
      validateOptions(
        (SchemaBuilder) => SchemaBuilder.emptySchema().addString('secret').addString('select'),
        (value) => async (parse) => {
          const { secret, select } = value;

          type VaultResponse<T> = {
            data: {
              data: T;
            };
            metadata: {
              destroyed: boolean;
            };
          };

          const path = secret.includes('/') ? secret : `secret/data/${secret}`;

          const {
            data: { data },
          } = await vaultApi
            .get(buildPath('v1', path))
            .withQuery({ version: '2' })
            .json<VaultResponse<JsonObject>>();

          const namedValue = data[select];

          if (typeof namedValue === 'undefined') {
            throw new Error(
              `The named value "${select}" was not found in the KV secret "${secret}"`,
            );
          }

          return parse(namedValue as Json, { shouldFlatten: true });
        },
      ),
    ),
  );
}

export default vaultParsingExtension;
