var YoungToken = artifacts.require('YoungToken');

module.exports = function(deployer){
    var TokenInstance;
    var TeamTimeLock;
    deployer.deploy(YoungToken, "0xf488e6a065BC09C598B12F92CbC2E0EE35c7Fe34", 150000000).then(async ()=>{
        TokenInstance = await YoungToken.deployed();
        TeamTimeLock = await TokenInstance.mintLockTeamTokens("0xb144eFdE5f73C3075f05c256436Feb24db8969e4");
        console.log(TeamTimeLock);
    })
}