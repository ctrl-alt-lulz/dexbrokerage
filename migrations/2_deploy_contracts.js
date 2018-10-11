var DexBrokerageToken = artifacts.require("DexBrokerageToken");

module.exports = function(deployer) {
  deployer.deploy(DexBrokerageToken);
};
