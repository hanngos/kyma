const k8s = require('@kubernetes/client-node');
const {fromBase64, getEnvOrThrow, debug} = require('../utils');

const GARDENER_PROJECT = 'garden-kyma-dev';
const COMPASS_ID_ANNOTATION_KEY = 'compass.provisioner.kyma-project.io/runtime-id';

class GardenerConfig {
  static fromEnv() {
    return new GardenerConfig({
      kubeconfigPath: getEnvOrThrow('GARDENER_KUBECONFIG'),
    });
  }

  static fromString(kubeconfig) {
    return new GardenerConfig({
      kubeconfig: kubeconfig,
    });
  }

  constructor(opts) {
    opts = opts || {};
    this.kubeconfigPath = opts.kubeconfigPath;
    this.kubeconfig = opts.kubeconfig;
  }
}

class GardenerClient {
  constructor(config) {
    config = config || {};
    const kc = new k8s.KubeConfig();
    if (config.kubeconfigPath) {
      kc.loadFromFile(config.kubeconfigPath);
      debug("Loading from kubeconfig path")
    } else if (config.kubeconfig) {
      kc.loadFromString(config.kubeconfig);
      debug("Loading kubeconfig from string")
    } else {
      debug("Unable to load kubeconfig")
      throw new Error('Unable to create GardenerClient - no kubeconfig');
    }

    this.coreV1API = kc.makeApiClient(k8s.CoreV1Api);
    this.dynamicAPI = kc.makeApiClient(k8s.KubernetesObjectApi);
  }

  async getShoot(shootName) {
    const secretResp = await this.coreV1API.readNamespacedSecret(
        `${shootName}.kubeconfig`,
        GARDENER_PROJECT,
    );
    debug("Reading namespace secret")
    const shootResp = await this.dynamicAPI.read({
      apiVersion: 'core.gardener.cloud/v1beta1',
      kind: 'Shoot',
      metadata: {
        name: shootName,
        namespace: GARDENER_PROJECT,
      },
    });
    debug("Reading shoot")

    return {
      name: shootName,
      compassID: shootResp.body.metadata.annotations[COMPASS_ID_ANNOTATION_KEY],
      kubeconfig: fromBase64(secretResp.body.data['kubeconfig']),
      oidcConfig: shootResp.body.spec.kubernetes.kubeAPIServer.oidcConfig,
    };
  }
}

module.exports = {
  GardenerConfig,
  GardenerClient,
};
