import { stripIndents } from 'common-tags';

beforeAll(() => {
  process.env.APP_CONFIG_SECRETS_PUBLIC_KEY = stripIndents`
    -----BEGIN PGP PUBLIC KEY BLOCK-----
    Version: OpenPGP.js v4.10.4
    Comment: https://openpgpjs.org

    xjMEX0MHUBYJKwYBBAHaRw8BAQdAccRdeW5EwIYozqND+BNg8ct5wyA7GTCO
    Zs6JfTEsaPLNHVRlc3RpbmcgPHRlc3RpbmdAZXhhbXBsZS5jb20+wngEEBYK
    ACAFAl9DB1AGCwkHCAMCBBUICgIEFgIBAAIZAQIbAwIeAQAKCRDxlAxoUXz+
    JCmPAQCOtqBqfaRKST8gebk+6Vpi12mujJtEmju31FrzQfl67QD9HgfuTI6U
    brN86nBRbdzGirDG9irESlTF2kntpdyfMg/OOARfQwdQEgorBgEEAZdVAQUB
    AQdAxlo/KExmM8fqHs/4EF5qProrV+Q1ox9wO03a9FXNZwUDAQgHwmEEGBYI
    AAkFAl9DB1ACGwwACgkQ8ZQMaFF8/iS4EQD/W/mrRGVaJFIsLHJTiREE/rHY
    n7HtBMOvhyZug5XpIfUA/2JzAW9M7TTvByI6u+AXUSEKJFCPcR3l/6JZYHBX
    vgQJ
    =JhTZ
    -----END PGP PUBLIC KEY BLOCK-----
  `;

  process.env.APP_CONFIG_SECRETS_KEY = stripIndents`
    -----BEGIN PGP PRIVATE KEY BLOCK-----
    Version: OpenPGP.js v4.10.4
    Comment: https://openpgpjs.org

    xVgEX0MHUBYJKwYBBAHaRw8BAQdAccRdeW5EwIYozqND+BNg8ct5wyA7GTCO
    Zs6JfTEsaPIAAQD2xF/CSEoNXZaa80nbdpnZa+LtZMdgoZdBmAKP+90SuBIQ
    zR1UZXN0aW5nIDx0ZXN0aW5nQGV4YW1wbGUuY29tPsJ4BBAWCgAgBQJfQwdQ
    BgsJBwgDAgQVCAoCBBYCAQACGQECGwMCHgEACgkQ8ZQMaFF8/iQpjwEAjrag
    an2kSkk/IHm5PulaYtdproybRJo7t9Ra80H5eu0A/R4H7kyOlG6zfOpwUW3c
    xoqwxvYqxEpUxdpJ7aXcnzIPx10EX0MHUBIKKwYBBAGXVQEFAQEHQMZaPyhM
    ZjPH6h7P+BBeaj66K1fkNaMfcDtN2vRVzWcFAwEIBwAA/1Fz2mYUbcwNAtZP
    NkhhCjuzEPkENz87sdhAKafv79XQDzXCYQQYFggACQUCX0MHUAIbDAAKCRDx
    lAxoUXz+JLgRAP9b+atEZVokUiwsclOJEQT+sdifse0Ew6+HJm6Dlekh9QD/
    YnMBb0ztNO8HIjq74BdRIQokUI9xHeX/ollgcFe+BAk=
    =C5fh
    -----END PGP PRIVATE KEY BLOCK-----
  `;
});

const originalEnvironment = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnvironment };
});
