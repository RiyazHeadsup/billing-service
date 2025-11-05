const consul = require('consul');

class ConsulConfig {
  constructor(options = {}) {
    this.consulClient = consul({
      host: options.host || process.env.CONSUL_HOST || '127.0.0.1',
      port: options.port || parseInt(process.env.CONSUL_PORT) || 8500
    });
    
    const servicePort = options.servicePort || parseInt(process.env.PORT) || 3001;
    // ✅ FIX: Changed from localhost to user-service
    const serviceAddress = options.address || process.env.SERVICE_ADDRESS || 'user-service';
    
    this.serviceConfig = {
      // ✅ FIX: Added unique ID with port
      id: `${process.env.SERVICE_NAME || 'userservice'}-${servicePort}`,
      name: options.name || process.env.SERVICE_NAME || 'userservice',
      port: servicePort,
      address: serviceAddress,
      check: {
        http: `http://${serviceAddress}:${servicePort}/health`,
        interval: options.healthCheckInterval || process.env.HEALTH_CHECK_INTERVAL || '10s',
        timeout: '5s',
        deregistercriticalserviceafter: '30s'
      },
      tags: ['user', 'authentication', 'microservice']
    };
  }

  async registerService() {
    try {
      console.log('Attempting to register service with config:', this.serviceConfig);
      await new Promise((resolve, reject) => {
        this.consulClient.agent.service.register(this.serviceConfig, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      console.log(`✅ Registered ${this.serviceConfig.name} with Consul at ${this.serviceConfig.address}:${this.serviceConfig.port}`);
    } catch (error) {
      console.error('❌ Failed to register with Consul:', error.message);
      console.error('Full error:', error);
      console.log('🔄 Service will continue without Consul registration');
    }
  }

  async deregisterService() {
    try {
      await new Promise((resolve, reject) => {
        this.consulClient.agent.service.deregister(this.serviceConfig.id, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      console.log(`🛑 Service '${this.serviceConfig.name}' deregistered from Consul`);
    } catch (error) {
      console.error('❌ Failed to deregister from Consul:', error.message);
    }
  }

  getServiceConfig() {
    return { ...this.serviceConfig };
  }
}

module.exports = ConsulConfig;