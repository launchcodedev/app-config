---
title: Settings & Meta Files
---

## The Meta File

Meta files live alongside schema and config files. They describe anything non-configuration.
Meta files live in `.app-config.meta.{ext}`.

Currently, the important values stored in meta files are:

1. Encryption keys and team members
2. Code generation steps
3. Overrides for parsing and environment variable names

One thing is special about meta files - if one is _not_ found in the current working directory,
App Config will try to look at parent directories until it finds a repository root.
This is a special case for workspaces, and you will probably never have to care.

Meta files are processed similarly to config files, but do not support environment-specific values.
Currently, only the `$extends` directive is supported.

Other than code generation, you'll probably never need to look at meta files.

A typical meta file, just for an example:

<h4 style="text-align:center">.app-config.meta.yml</h4>

```yaml
generate:
  - { file: 'src/@types/lcdev__app-config/index.d.ts' }

teamMembers:
  - userId: Joe Blow <joe@example.com>
    publicKey: "-----BEGIN PGP PUBLIC KEY BLOCK-----\r\nVersion: OpenPGP.js v4.10.8\r\nComment: https://openpgpjs.org\r\n\r\nxjMEX8mmshYJKwYBBAHaRw8BAQdAutNgPqlb5Iqw7xx3eMvNK5O1vbdLENDs\r\nZkVebLwFl9PNGkpvZSBCbG93IDxqb2VAZXhhbXBsZS5jb20+wo8EEBYKACAF\r\nAl/JprIGCwkHCAMCBBUICgIEFgIBAAIZAQIbAwIeAQAhCRD8UMumP1cfjxYh\r\nBNcX0H6tdCsdTHyCQfxQy6Y/Vx+PowMA/Rw+lHO64c0Rc4JGHfU/7nB3lPla\r\nrOb3kYdduqrdCbWTAQCHpLO5tWGuaWUqIoDCi5MiNNpMblJssssvRTimCLit\r\nBc44BF/JprISCisGAQQBl1UBBQEBB0DvkU/lPcOBF7MQepEK27gGIsszl36l\r\nIHIbmZwUAlH6GAMBCAfCeAQYFggACQUCX8mmsgIbDAAhCRD8UMumP1cfjxYh\r\nBNcX0H6tdCsdTHyCQfxQy6Y/Vx+P+UcA/Rdt9JgNqg2jMK5Lk7RqCnluTwKG\r\nm5p+W+34mi872rUTAQDX8PuMWPIzPkLp/InkLUO+fhBqbPPXXNu4wNnz79QO\r\nAQ==\r\n=Icsa\r\n-----END PGP PUBLIC KEY BLOCK-----\r\n"

encryptionKeys:
  - revision: 1
    key: "-----BEGIN PGP MESSAGE-----\r\nVersion: OpenPGP.js v4.10.8\r\nComment: https://openpgpjs.org\r\n\r\nwV4DSfxLNt2seUQSAQdAcoEGyjWJhnyuopcOhwiUoCoTOfOHyitNHDcuL1OR\r\nFg4wMvZg0uINadxFkyyxRR2zYGzrzeUgkt80E0x8d8HL8F91AQFIqaQ/LJjX\r\nNns81a1W0sd7AXpmV0gr47DJwZJ1ncgeZPMqfJ0nKrmmEywy6ULbDtEMffdt\r\nt50xUnd9sTRWzDNaLkSZLGKVGi6gARfYhr81u0ryNg4yafZV/dUkbQSw2pdt\r\n/QFMvYw6rG4ccvAxNNiJazSzymg4ucwckdaAODR23PVw0vsVEDcidmDG93d/\r\na2d+CovwNUS8XprrGsQthhLJT6vx9WrpNQkfnRKYJujsH1A6v+p5ERTPPf7W\r\nIf7nWT8zAjlfF9PIapYAdqDNs8IZ012J1gWtCpXSbHIWVxU8GlkZQDqdgVeH\r\nH6TrjP9AscQJgKhV8sh5WMGEAnTAdT4dXfmV+3vKHR3Ft0K0kKy7QVkXEAzD\r\nIvr16dsR+TuJ93k+ptLz/P+Uf++I/C0h4oVD+wbKDkbe16YzpGSWLIoQdOhr\r\nN2X2XyORg3PYBbnBbCkMAGKJm5QmdDbGuQqK5o6Vt3QNTo72MyHBa+U1fuIH\r\nJQ3k1lcxrWyLMFuxCwIrH6hzwZKs+eq5W3cfiTAWyL9Hl7p7a8m8Zb/du/qY\r\n6N44dOkgZWToFE5ay9yPNdyIFJYyN0R5d4vItS7HZ7ol/vYaRvllVb0dSf6G\r\nT4GolaJkJ+LNWfBo1gslBUPvf/VDcsvygWkStzOksIxqP16U8GxZczHT+iow\r\nXogWi/+oIRENWiKIfXrTbKE8c2JXrC1bTiZ23weNqaJG33s/eTrieVhpkJUH\r\nnk3q6rWXF4VIYSCsaiVXAmAMqIak5eua2qKSsTsNEIeWVr8KdtVPD2GwdpX4\r\nUUhwhtx2UyxypD7GkIZnCexvtIMAV09zvdWLsqjpyJf63Qo0I063jB5Ik/Ho\r\nCBXsUL5Yt6RwFp0Htkibwll29jn861AIi+CVUHx9YXo3W0YnIMPayyIwAoaZ\r\nmaK6MuMM42bcmvUxZsBXaTBFChg5gGSQQCZKi2k8M/jim6pn06EciPvGQ1sq\r\nV2PPtGacg5s0fG9L5DtyrHXz8xjxQJqgyTmm9PabfwkrOizVWucH9YoiJPGq\r\nj5Zc9KY3ZR+zvZqPo7hbRLz6tfSO11birf1+jn4HRF047tTNDdTQ5cHVC7iv\r\nBV3KfZANg0pmMW7+yJtkDxlPPIGXpTwubK2eqTk1k4AGRQzMyT6S48ZsRFGP\r\nktq8EuPQx8wOrYBOKApooWEQbPpPMe+Y9RhcQvjWEqxKKkkmKC4g8oGl90ms\r\nyq3g6tiVGFOd2GnOptgaCYjGE/Utl/Itl7Gue3sIt32Yu7xRqzVGofWGN4Bw\r\nHlPaJ/GKIf3sqbRQacD5Dl8FpelAXEao7q7cUAFmsDSzi66f66S5/6hWxzHh\r\nyvQCy1F/Uzzd3AwFo5F+3tYUFPwi02GreRkHAlRf9X16+domwY/0WWLWDnRQ\r\nH8nHnmFgxopAXPg1mQkXSBUwPUikljCiQl6HkidTc3IPeaHDHo/6DRZsIu2D\r\n43mD7u1wlg2G8HUCsbLeyU1GG/T5lFr/crIv9IVlfYovddu3Wx031wSrQ2MO\r\nh/uWdPe1wpvWXI/TBu8LLnYy/RDq4TwNbf1Bc9TSQQasY/P9d/4nQhAT7P85\r\nGRbznbYKeH7WE+pQktWSqppPHutYkYHMXLGaOGLykar49lFLQO0xSqaEaymp\r\nBgT+ivgxFik2+mMOgrN/tM1oApNQd+U+yb3lq82q+WUcnuNsmk1Id76dWq8W\r\n8CLB+7kRnRrkyEVj/L1EOO9BDJG0CCz8aMyqWInQR9BJ5oRSs8b5alWxLRFj\r\nSWM144vdVlymSYSkZj5W+hkZ/xYzr3uV0udUDdN7xU+PFl+pDuGYAS9guePk\r\nAlZ2ESbIX0SBAL1ZsTZW94i0dnGvxHLvmouWLCpNOhZuRE88v17JO7aDe9DO\r\nfH0ROJJ5RzG2oR/wrnf+WyN2AreGRkZqJ/gFZkFR+DFlBO9vMNW722Ud68Sn\r\njz+tapQvWG7Wq89m3TN9/+gQRR7Cwk55QkLqBiLWZCBwaBJtUwKXBLUAbw4c\r\nAFNVx3LeQi1HgFRoN3oW/bJg+I7zlKIugRv4N504u2kwCPXoVoD121FDUtCh\r\nnASnbpoLeUzTgGFhHwKMIBYff3mR2c0d09JiQEbLtpYFKh2EEwpufVRva4wY\r\n6yPrCnBJ6rJ0JXcp5A+WW46E2boxwa1SF4pj4u9QfCrQfX8GsRqdJEHHSXSQ\r\nJStWpuSMz9dbQFAbIiUVaTFTcco/Uqgw/addYkJjmBN4XqGhcasuZq+dx+Dg\r\ntwg13xP65ckEk/SFKFM98BwHK7nGfE9o3U9xMErOMfbKGDy1pkGhXSGcfAFW\r\nkXuNzmBH4wM/yzfMx4Dt8+fx3AY//eifa3+PJPM32voGZ/Du6aQ+AmjvCP/N\r\nSKZcG+pbGDnhnbzyxmcqaTDIqxl6buT1pa1iGxjPMp0z6gO0Yhz7GWivntkC\r\nkhn64LvDYWFI1VR8RrglRDhMsOBzGyxLO4+HueMeK7eq+H8Kz78GHd22qrBQ\r\n8ZTB2l+5+D7SWz7D9Td1U+zQDGFr7HgUsvdT7/lH2hVFj4fYJsKvCG/KDJM3\r\nsoOTdAqJkNqKYq9Gq8f3SJPTQTdc20QbOp9KLFZ+43sRRUMpBJrTZdN5FrkN\r\nE6/Cq3fIsi4qJ37FjwT9Dw2e6FeJDDqYoP9s8Q6daNgpp6ZdXjNqm1XZnr8C\r\nWPF4kaNR46z0HHGDf/u5ub9m7706pJDQZrRIcI/Tg48mNIcymuoUt/FNXEBS\r\ntG4lwkz4vo/Zkd8DhMJL6TwAGRFw/fy8rkZoEh0OS+OLsgkQoBxE+bggOeLz\r\nDL1eQDiz1nS82IE1LGhEb7VU0MBwZq1TZFoKH+Z8y/GJJGcXe5dtGjkwluxr\r\nbg==\r\n=xBAf\r\n-----END PGP MESSAGE-----\r\n"
```

## Parse and Loading Configuration

The meta file can contain:

- `parsingExtensions`: an array of NPM modules to load as parsing extensions ([more](./extensions.md#loading-custom-extensions))
- `environmentAliases`: an object that maps 'aliases' to real environment names
  - eg. `{ Release: 'production' }`
- `environmentSourceNames`: a string or array of strings that are used an environment variable names to read for the current environment
  - eg. `['ENV', 'NODE_ENV', 'MY_ENV']`

## App Config Settings

There are a small set of user settings that App Config stores.
We use [env-paths](https://www.npmjs.com/package/env-paths) to select an OS appropriate directory.

1. Encryption Keychain: your public and private key!
2. Secret Agent Configuration: how to reach secret-agent

You probably won't need to look at these.
