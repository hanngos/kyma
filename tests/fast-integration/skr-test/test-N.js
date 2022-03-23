const {getEnvOrThrow} = require("../utils");
const {gatherOptions, withInstanceID, withOIDC0} = require('./');
const {provisionSKR, deprovisionSKR} = require('../kyma-environment-broker');
const {keb, gardener, director} = require('./helpers');
const {initializeK8sClient} = require('../utils');
const {unregisterKymaFromCompass, addScenarioInCompass, assignRuntimeToScenario} = require('../compass');
const {oidcE2ETest, commerceMockTest} = require('./skr-test-N');
const {KCPWrapper, KCPConfig} = require('../kcp/client');

const SKR_CLUSTER = process.env.SKR_CLUSTER === "true";

const kcp = new KCPWrapper(KCPConfig.fromEnv());

const delay = millis => new Promise((resolve, reject) => {
  setTimeout(_ => resolve(), millis)
});

describe('Execute SKR test', function () {
  this.timeout(60 * 60 * 1000 * 3); // 3h
  this.slow(5000);

  const provisioningTimeout = 1000 * 60 * 30; // 30m
  const deprovisioningTimeout = 1000 * 60 * 95; // 95m

  before('Provision SKR', async function () {
    try {
      if (!SKR_CLUSTER) {
        this.options = gatherOptions();
        console.log(`Provision SKR with instance ID ${this.options.instanceID}`);
        const customParams = {
          oidc: this.options.oidc0,
        };
        const skr = await provisionSKR(keb, kcp, gardener,
            this.options.instanceID,
            this.options.runtimeName,
            null,
            null,
            customParams,
            provisioningTimeout);

        this.shoot = skr.shoot;
      } else {
        this.shoot = await gardener.getShoot(getEnvOrThrow("SHOOT_NAME"));

        this.options = gatherOptions(
            withInstanceID(getEnvOrThrow("INSTANCE_ID")),
            withOIDC0(this.shoot.oidcConfig))
      }
      const runtimeStatus = await kcp.getRuntimeStatusOperations(this.options.instanceID);
      console.log(`\nRuntime status after provisioning: ${runtimeStatus}`);
      // await addScenarioInCompass(director, this.options.scenarioName);
      // await assignRuntimeToScenario(director, this.shoot.compassID, this.options.scenarioName);
      // initializeK8sClient({kubeconfig: this.shoot.kubeconfig});
///TODO
      console.log(this.shoot.name)
      await kcp.getLastReconciliation(this.shoot.name)
///
    } catch (e) {
      throw new Error(`before hook failed: ${e.toString()}`);
    } finally {
      //const runtimeStatus = await kcp.getRuntimeStatusOperations(this.options.instanceID);
      //await kcp.reconcileInformationLog(runtimeStatus);
    }
  });

  for (let i = 0; i < 1; i++) {
    describe('Loop', function () {
      before('Before', async function () {
        this.options = gatherOptions(
            withInstanceID(this.options.instanceID),
            withOIDC0(this.shoot.oidcConfig));
        await addScenarioInCompass(director, this.options.scenarioName);
        await assignRuntimeToScenario(director, this.shoot.compassID, this.options.scenarioName);
        initializeK8sClient({kubeconfig: this.shoot.kubeconfig});
        await delay(60000);
      })
      oidcE2ETest();
      //commerceMockTest();//Uncaught Error: listen EADDRINUSE: address already in use 127.0.0.1:9090
//503: Service Unavailable: "no healthy upstream"
      after('After', async function(){
        await unregisterKymaFromCompass(director, this.options.scenarioName);
      })
    });
  }


  after('Deprovision SKR', async function () {
    try {
      if (!SKR_CLUSTER) {
        await deprovisionSKR(keb, kcp, this.options.instanceID, deprovisioningTimeout);
      }
    } catch (e) {
      throw new Error(`before hook failed: ${e.toString()}`);
    } finally {
      // const runtimeStatus = await kcp.getRuntimeStatusOperations(this.options.instanceID);
      // console.log(`\nRuntime status after deprovisioning: ${runtimeStatus}`);
      //await kcp.reconcileInformationLog(runtimeStatus);
      //await unregisterKymaFromCompass(director, this.options.scenarioName);
    }
  });
});
