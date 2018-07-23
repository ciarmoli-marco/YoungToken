
var YoungToken = artifacts.require("YoungToken");
var TokenTimelock = artifacts.require("TokenTimelock");
var token;
var decimals = 4;
var expectedCap = 150000000*10**decimals;


contract('YoungToken', function(accounts) {
  var token;
  
  beforeEach(function() {
    return YoungToken.new(accounts[1], 150000000)
    .then(function(instance) {
       token = instance;
    });
  });

  //CREATION
  it("creation: should return correct token cap", async function() {
    var cap = await token.cap.call();
    assert.equal(cap.toNumber(),expectedCap,"Wrong cap");
  });

  it("creation: check owner", async function() {
    var isAuthorized = await token.isAuthorized(accounts[0]);
    assert.ok(isAuthorized,"User is not owner");
  });
  it("creation: should mint advisors tokens", async function(){
    var balance = await token.balanceOf(accounts[1]);
    var advisorsPercentage = await token.advisorsPercentage.call();
    var cap = await token.cap.call();
    var expectedBalance = cap.toNumber() * advisorsPercentage.toNumber() / 100;
    assert.equal(balance.toNumber(),expectedBalance,"Advisors tokens number is not correct!");
    var totalSupply = await token.totalSupply();
    assert.equal(totalSupply.toNumber(),balance.toNumber(),"Total supply is not correct!");
  });

  //TRANSFERS
  it('transfers: should allow to transfer all the tokens from one account to another', async () => {
    var amount = await token.balanceOf(accounts[1]);
    await token.transfer(accounts[0], amount.toNumber(), { from: accounts[1] });
    var balanceReceiver = await token.balanceOf(accounts[0]);
    var balanceSender = await token.balanceOf(accounts[1]);
    //Check if transfer was successful
    assert.equal(balanceReceiver.toNumber(), amount.toNumber());
    assert.equal(balanceSender.toNumber(),0);
  });
  it('transfers: should fail to transfer more tokens than owned', async () => {
    let err;
    var amount = await token.balanceOf(accounts[1]);
    try{
      await token.transfer(accounts[0], amount+1, { from: accounts[1] });
    } catch(error){
      err = error;
    }
    assert.ok(err != undefined);
    //Check if the balance is untouched
    var balanceReceiver = await token.balanceOf(accounts[0]);
    var balanceSender = await token.balanceOf(accounts[1]);
    assert.equal(balanceSender.toNumber(), amount);
    assert.equal(balanceReceiver.toNumber(),0);
  });

  //APPROVALS
  it('approvals: should manage to approve tokens', async () => {
    await token.approve(accounts[1], 10, { from: accounts[0] });
    var allowance = await token.allowance.call(accounts[0], accounts[1]);
    assert.equal(allowance.toNumber(), 10);
  });

  it('approvals: should allow to send approved tokens', async () => {
    var balanceOwner = await token.balanceOf(accounts[1]);
    var balanceReceiver = await token.balanceOf(accounts[0]);
    await token.approve(accounts[0], 10, { from: accounts[1] });
    var allowance = await token.allowance.call(accounts[1], accounts[0]);
    assert.equal(allowance.toNumber(), 10);
    await token.transferFrom(accounts[1],accounts[0],10,{from:accounts[0]});
    var balanceOwnerAfter = await token.balanceOf(accounts[1]);
    var balanceReceiverAfter = await token.balanceOf(accounts[0]);
    allowance = await token.allowance.call(accounts[1],accounts[0]);
    assert.equal(balanceOwnerAfter.toNumber(),balanceOwner.toNumber()-10);
    assert.equal(balanceReceiverAfter.toNumber(),balanceReceiver.toNumber()+10);
    assert.equal(allowance.toNumber(),0);
  });

  it("approvals: shouldn't allow to send more than the approved tokens", async () => {
    var balanceOwner = await token.balanceOf(accounts[1]);
    var balanceReceiver = await token.balanceOf(accounts[0]);
    await token.approve(accounts[0], 10, { from: accounts[1] });
    var allowance = await token.allowance.call(accounts[1], accounts[0]);
    assert.equal(allowance.toNumber(), 10);
    let err;
    try{
      await token.transferFrom(accounts[1],accounts[0],11,{from:accounts[0]});
    } catch(error) {
      err = error;
    }
    assert.ok(err != undefined);
    var balanceOwnerAfter = await token.balanceOf(accounts[1]);
    var balanceReceiverAfter = await token.balanceOf(accounts[0]);
    allowance = await token.allowance.call(accounts[1],accounts[0]);
    assert.equal(balanceOwner.toNumber(),balanceOwnerAfter.toNumber());
    assert.equal(balanceReceiver.toNumber(),balanceReceiverAfter.toNumber());
    assert.equal(allowance.toNumber(),10);
  });

  it('approvals: should approve max (2^256 - 1)', async () => {
    await token.approve(accounts[1], '115792089237316195423570985008687907853269984665640564039457584007913129639935', { from: accounts[0] });
    const allowance = await token.allowance(accounts[0], accounts[1]);
    assert(allowance.equals('1.15792089237316195423570985008687907853269984665640564039457584007913129639935e+77'));
  });

  //AUTHORIZATIONS
  it("authorizations: should allow to add authorized address only by owner", async function() {
    //First fail because not owner
    let err;
    try{
      await token.addAuthorized(accounts[2],{from:accounts[1]});
    } catch (error){
      err = error;
    }
    assert.ok(err != undefined, "onlyOwner is not working");

    //Add authorized by owner
    await token.addAuthorized(accounts[2]);

    //Check if it is authorized
    var isAuthorized = await token.authorized.call(accounts[2]);
    assert.ok(isAuthorized);
  });

  it("authorizations: should allow only an authorized address to mint", async function() {
    //First fail because not authorized
    let err;
    try{
      await token.mint(accounts[5],1,{from:accounts[5]});
    } catch (error){
      err = error;
    }
    assert.ok(err != undefined, "onlyAuthorized is not working");
    //Add authorized
    await token.addAuthorized(accounts[5]);
    //Now try to mint again
    await token.mint(accounts[5], 1, {from:accounts[5]});
    var balance = await token.balanceOf(accounts[5]);
    assert.ok(balance == 1,"Mint failed");

  });

  it("mint: shouldn't allow to mine a number of tokens higher than the cap", async function() {
    var cap = await token.cap.call();
    let err;
    try{
      await token.mint(accounts[4],cap);
    } catch (error){
      err = error;
    }
    assert.ok(err != undefined, "The token cap is not working");
  });

  it("team tokens: should mint team tokens", async function(){
    //First fail if not owner
    let err = null;
    var teamLockAddress;
    try{
      teamLockAddress =await token.mintLockTeamTokens(accounts[3],{from:accounts[2]});
    } catch(error){
      err = error;
    }
    assert.ok(err != undefined,"The function allows the execution if not owner"); //If false, the function allows execution by non owner

    var totalSupply = await token.totalSupply.call();
    var cap = await token.cap.call();
    var teamPercentage = await token.teamPercentage.call();

    var expectedBalance = cap.toNumber() * teamPercentage.toNumber() / 100;
    var expectedTotalSupply = totalSupply.toNumber() + expectedBalance;

    teamLockAddress =await token.mintLockTeamTokens.call(accounts[3],{from:accounts[0]});
    await token.mintLockTeamTokens(accounts[3],{from:accounts[0]});

    //Check balance and totalsupply;
    var balance = await token.balanceOf(teamLockAddress);
    var totalSupplyAfter = await token.totalSupply();
    assert.ok(balance.toNumber() == expectedBalance);
    assert.ok(totalSupplyAfter.toNumber() == expectedTotalSupply);

    //Fail second time
    try{
      teamLockAddress =await token.mintLockTeamTokens(accounts[3],{from:accounts[0]});
    } catch(error){
      err = error;
    }
    assert.ok(err != undefined,"The function allows to mint twice"); //If false, the function allows to mint twice

  });

  it("team tokens: should keep team tokens locked for 6 months", async function(){
    
    var teamLockAddress =await token.mintLockTeamTokens.call(accounts[3],{from:accounts[0]});
    await token.mintLockTeamTokens(accounts[3],{from:accounts[0]});
    var lock = TokenTimelock.at(teamLockAddress);

    //Try to withdraw tokens before 6 months
    let err;
    try{
      await lock.release();
    }
    catch(error){
      err = error;
    }
    
    assert.ok(err != undefined,"It doesn't lock the tokens"); //If false, the lock doesn't work

    //After 6 months
    web3.currentProvider.send({jsonrpc:"2.0",method:"evm_increaseTime",params:[60*60*24*30*6],id:0});
    web3.currentProvider.send({jsonrpc: "2.0", method: "evm_mine", params: [], id: 0});

    var lockBalance = await token.balanceOf(teamLockAddress);
    var teamBalance = await token.balanceOf(accounts[3]);

    await lock.release();

    var lockBalanceAfter = await token.balanceOf(teamLockAddress);
    var teamBalanceAfter = await token.balanceOf(accounts[3]);

    assert.equal(lockBalance.toNumber(),teamBalanceAfter.toNumber(),"Something went wrong with the transfer");
    assert.equal(teamBalance.toNumber(),lockBalanceAfter.toNumber(),"Something went wrong with the transfer");

  });

  //BURN
  it('burn: should burn tokens properly', async() => {
    var cap = await token.cap.call();
    var totalSupply = await token.totalSupply.call();
    var balance = await token.balanceOf.call(accounts[1]);
    await token.burn(balance.toNumber(),{from:accounts[1]});
    var capAfter = await token.cap.call();
    var totalSupplyAfter = await token.totalSupply.call();
    var balanceAfter = await token.balanceOf.call(accounts[1]);
    assert.equal(capAfter.toNumber(),cap.toNumber() - balance.toNumber());
    assert.equal(totalSupplyAfter.toNumber(),totalSupply - balance.toNumber());
    assert.equal(balanceAfter.toNumber(),0);
  });

  //EVENTS
  it('events: should fire Transfer events', async () => {
    var tx = await token.transfer(accounts[0], '1000', { from: accounts[1] });
    var transferLog = tx.logs.find(element => element.event.match('Transfer'));
    assert.strictEqual(transferLog.args.from, accounts[1]);
    assert.strictEqual(transferLog.args.to, accounts[0]);
    assert.strictEqual(transferLog.args.value.toString(), '1000');
  });

  it('events: should fire Approval events', async () => {
    var tx = await token.approve(accounts[0], '1000', { from: accounts[1] });
    var approvalLog = tx.logs.find(element => element.event.match('Approval'));
    assert.strictEqual(approvalLog.args.owner, accounts[1]);
    assert.strictEqual(approvalLog.args.spender, accounts[0]);
    assert.strictEqual(approvalLog.args.value.toString(), '1000');
  });

  it('events: should fire Mint events', async () => {
    var tx = await token.mint(accounts[1], '1000');
    var mintLog = tx.logs.find(element => element.event.match('Mint'));
    assert.strictEqual(mintLog.args.to, accounts[1]);
    assert.strictEqual(mintLog.args.amount.toString(), '1000');
  });

  it('events: should fire MintFinished events', async () => {
    var tx = await token.finishMinting();
    var mintLog = tx.logs.find(element => element.event.match('MintFinished'));
    assert.ok(mintLog != undefined);
  });

  it('events: should fire Burn events', async () => {
    var tx = await token.burn(100,{from:accounts[1]});
    var burnLog = tx.logs.find(element => element.event.match('Burn'));
    assert.strictEqual(burnLog.args.burner, accounts[1]);
    assert.strictEqual(burnLog.args.value.toString(), '100');
  });

});
