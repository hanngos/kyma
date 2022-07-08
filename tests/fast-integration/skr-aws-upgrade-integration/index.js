const {
  unregisterKymaFromCompass,
} = require('../compass');
const {
  keb,
  director,
  kcp,
  gatherOptions,
  withCustomParams,
} = require('../skr-test/helpers');
const {getOrProvisionSKR} = require('../skr-test/provision/provision-skr');
const {deprovisionSKRInstance} = require('../skr-test/provision/deprovision-skr');
const {upgradeSKRInstance} = require('./upgrade/upgrade-skr');
const {
  debug,
  getContainerRestartsForAllNamespaces,
  getEnvOrThrow,
  switchDebug,
} = require('../utils');
const {
  commerceMockTestPreparation,
  commerceMockTests,
  commerceMockCleanup,
} = require('../skr-test');

const skipProvisioning = process.env.SKIP_PROVISIONING === 'true';
const provisioningTimeout = 1000 * 60 * 60; // 1h
const deprovisioningTimeout = 1000 * 60 * 30; // 30m
const upgradeTimeoutMin = 30; // 30m
let globalTimeout = 1000 * 60 * 90; // 90m
const slowTime = 5000;

describe('SKR-Upgrade-test', function() {
  switchDebug(on = true);

  if (!skipProvisioning) {
    globalTimeout += provisioningTimeout + deprovisioningTimeout;  // 3h
  }
  this.timeout(globalTimeout);
  this.slow(slowTime);

  const kymaVersion = getEnvOrThrow('KYMA_VERSION');
  const kymaUpgradeVersion = getEnvOrThrow('KYMA_UPGRADE_VERSION');

  const customParams = {
    'kymaVersion': kymaVersion,
  };

  const options = gatherOptions(
      withCustomParams(customParams),
  );
  let skr;

  debug(
      `PlanID ${getEnvOrThrow('KEB_PLAN_ID')}`,
      `SubAccountID ${keb.subaccountID}`,
      `InstanceID ${options.instanceID}`,
      `Scenario ${options.scenarioName}`,
      `Runtime ${options.runtimeName}`,
      `Application ${options.appName}`,
  );

  //TODO
  // debug(
  //   `KEB_HOST: ${getEnvOrThrow("KEB_HOST")}`,
  //   `KEB_CLIENT_ID: ${getEnvOrThrow("KEB_CLIENT_ID")}`,
  //   `KEB_CLIENT_SECRET: ${getEnvOrThrow("KEB_CLIENT_SECRET")}`,
  //   `KEB_GLOBALACCOUNT_ID: ${getEnvOrThrow("KEB_GLOBALACCOUNT_ID")}`,
  //   `KEB_SUBACCOUNT_ID: ${getEnvOrThrow("KEB_SUBACCOUNT_ID")}`,
  //   `KEB_USER_ID: ${getEnvOrThrow("KEB_USER_ID")}`,
  //   `KEB_PLAN_ID: ${getEnvOrThrow("KEB_PLAN_ID")}`
  // );

  // debug(
  //   `COMPASS_HOST: ${getEnvOrThrow("COMPASS_HOST")}`,
  //   `COMPASS_CLIENT_ID: ${getEnvOrThrow("COMPASS_CLIENT_ID")}`,
  //   `COMPASS_CLIENT_SECRET: ${getEnvOrThrow("COMPASS_CLIENT_SECRET")}`,
  //   `COMPASS_TENANT: ${getEnvOrThrow("COMPASS_TENANT")}`,
  // )

  // debug(
  //   `KCP_TECH_USER_LOGIN: ${KCP_TECH_USER_LOGIN}\n`,
  //   `KCP_TECH_USER_PASSWORD: ${KCP_TECH_USER_PASSWORD}\n`,
  //   `KCP_OIDC_CLIENT_ID: ${KCP_OIDC_CLIENT_ID}\n`,
  //   `KCP_OIDC_CLIENT_SECRET: ${KCP_OIDC_CLIENT_SECRET}\n`,
  //   `KCP_KEB_API_URL: ${KCP_KEB_API_URL}\n`,
  //   `KCP_OIDC_ISSUER_URL: ${KCP_OIDC_ISSUER_URL}\n`
  // )

  // Credentials for KCP OIDC Login

  // process.env.KCP_TECH_USER_LOGIN    =
  // process.env.KCP_TECH_USER_PASSWORD =
  process.env.KCP_OIDC_ISSUER_URL = 'https://kymatest.accounts400.ondemand.com';
  // process.env.KCP_OIDC_CLIENT_ID     =
  // process.env.KCP_OIDC_CLIENT_SECRET =
  process.env.KCP_KEB_API_URL = 'https://kyma-env-broker.cp.dev.kyma.cloud.sap';
  process.env.KCP_GARDENER_NAMESPACE = 'garden-kyma-dev';
  process.env.KCP_MOTHERSHIP_API_URL = 'https://mothership-reconciler.cp.dev.kyma.cloud.sap/v1';
  process.env.KCP_KUBECONFIG_API_URL = 'https://kubeconfig-service.cp.dev.kyma.cloud.sap';


  // SKR Provisioning
  before(`Provision SKR with ID ${options.instanceID}`, async function() {
    console.log(`Provisioning SKR with version ${kymaVersion}`);
    debug(`Provision SKR with Custom Parameters ${JSON.stringify(options.customParams)}`);
    this.timeout(provisioningTimeout);
    await getOrProvisionSKR(options, skr, skipProvisioning, provisioningTimeout);
  });

  //TODO
  it(`Perform kcp login`, async function() {
    const version = await kcp.version([]);
    debug(version);
    await kcp.login();
  });

  // Perform Tests before Upgrade
  it('Execute commerceMockTestPreparation', async function() {
    commerceMockTestPreparation(options);
  });

  it('Listing all pods in cluster', async function() {
    await getContainerRestartsForAllNamespaces();
  });

  it('Execute commerceMockTests', async function() {
    commerceMockTests(options.testNS);
  });

  // Upgrade
  it('Perform Upgrade', async function() {
    await upgradeSKRInstance(options.instanceID, kymaUpgradeVersion, upgradeTimeoutMin);
  });

  // Perform Tests after Upgrade
  it('Listing all pods in cluster', async function() {
    await getContainerRestartsForAllNamespaces();
  });

  it('Execute commerceMockTests', async function() {
    commerceMockTests(options.testNS);
  });

  // Cleanup
  const skipCleanup = getEnvOrThrow('SKIP_CLEANUP');
  if (skipCleanup === 'FALSE') {
    after('Cleanup the resources', async function() {
      this.timeout(deprovisioningTimeout);
      await commerceMockCleanup(options.testNS);
      if (!skipProvisioning) {
        await deprovisionSKRInstance(options, deprovisioningTimeout);
      } else {
        console.log('An external SKR cluster was used, de-provisioning skipped');
      }
      await unregisterKymaFromCompass(director, options.scenarioName);
    });
  }
});
