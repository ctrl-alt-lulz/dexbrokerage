const DexBrokerageToken = artifacts.require("./DexBrokerageToken.sol");
const EtherForcer = artifacts.require("./test/EtherForcer.sol");
const ApproveAndCallMock = artifacts.require("./test/ApproveAndCallMock.sol");

let owner;
let user1;
let user2;
let token;

let totalSupply = web3.toWei("200000000", 'ether');
let moreThenTotalSupply = web3.toWei("200000001", 'ether');
let oneToken = web3.toWei("1", 'ether');
let twoTokens = web3.toWei("2", 'ether');

contract('Dex Brokerage Token', (accounts) => {

    beforeEach(async () => {
        owner = accounts[0];
        user1 = accounts[1];
        user2 = accounts[2];

        token = await DexBrokerageToken.new();
    });

    function expectRevert(e, msg) {
        assert(e.message.search('revert') >= 0, msg);
    }

    it("Fresh token has correct initial values", async () => {
        assert("Dex Brokerage Token" == await token.name.call());
        assert("DEXB" == await token.symbol.call());
        assert(18 == (await token.decimals.call()).toNumber());
        assert(!(await token.transferable.call()));
        assert(await token.transferGrants.call(owner));
        assert(totalSupply == (await token.totalSupply.call()).toNumber());
    });

    it("Can transfer tokens to any address when allowed", async () => {
        await token.enableTransfers();
		assert(await token.transferable.call());

        try {
            await token.enableTransfers();
            assert(false);
        } catch (e) {
            expectRevert(e, "transfers already enabled");
        }

        let tokenBalanceUserBefore = (await token.balanceOf.call(user1)).toNumber();
        await token.transfer(user1, oneToken, {from: owner});
        let tokenBalanceUserAfter = (await token.balanceOf.call(user1)).toNumber();
        assert(tokenBalanceUserBefore + oneToken == tokenBalanceUserAfter);
    });

    it("Can only transfer when granted right before transfers enabled", async () => {
        await token.transfer(user1, twoTokens, {from: owner});
        try {
            await token.transfer(owner, oneToken, {from: user1});
            assert(false);
        } catch (e) {
            expectRevert(e, "transfers not enabled");
        }

        await token.grantTransferRight(user1);
        assert(await token.transferGrants.call(user1));
        try{
            await token.grantTransferRight(user1);
            assert(false);
        } catch (e) {
            expectRevert(e, "user1 already has grant transfer");
        }

        try{
            await token.grantTransferRight('0x0');
            assert(false);
        } catch (e) {
            expectRevert(e, "address(0) is excluded from transfer grants");
        }

        await token.transfer(owner, oneToken, {from: user1});

        await token.cancelTransferRight(user1);
        assert(!(await token.transferGrants.call(user1)));
        try{
            await token.cancelTransferRight(user1);
            assert(false);
        } catch (e) {
            expectRevert(e, "user1 already cancelled grant transfer");
        }
        assert(!(await token.transferGrants.call('0x0')));

        try {
            await token.transfer(owner, oneToken, {from: user1});
            assert(false);
        } catch (e) {
            expectRevert(e, "transfers not enabled");
        }
        assert(oneToken == (await token.balanceOf.call(user1)).toNumber());
    });

    it("Once transfers enabled cannot change transfer rights", async () => {
        await token.enableTransfers();

        try {
            await token.grantTransferRight(user1);
            assert(false);
        } catch (e) {
            expectRevert(e, "transfers are already enabled");
        }
        assert(!(await token.transferGrants.call(user1)));

        try {
            await token.cancelTransferRight(owner);
            assert(false);
        } catch (e) {
            expectRevert(e, "transfers are already enabled");
        }
        assert(await token.transferGrants.call(owner));
    });

    it("Only valid token transfers succeed", async () => {
        await token.enableTransfers();

        try {
            await token.transfer('0x0', twoTokens, {from: owner});
            assert(false);
        } catch (e) {
            expectRevert(e, "cannot transfer to address(0)");
        }

        try {
            await token.transfer(user1, moreThenTotalSupply, {from: owner});
            assert(false);
        } catch (e) {
            expectRevert(e, "cannot transfer more than in the balance");
        }
    });

    it("Allowed third party can transfer tokens on ones behalf", async () => {
        await token.transfer(user2, twoTokens, {from: owner});

        try {
            await token.approve(user1, twoTokens, {from: user2});
            assert(false);
        } catch (e) {
            expectRevert(e, "approve shouldn't work before tokens are transferable");
        }

        await token.enableTransfers();
        await token.approve(user1, twoTokens);
        assert(twoTokens == (await token.allowance.call(owner, user1)).toNumber(), "allowance matches");
        await token.transferFrom(owner, user1, oneToken, {from: user1});
        try {
            await token.transferFrom(owner, user1, twoTokens, {from: user1});
            assert(false);
        } catch (e) {
            expectRevert(e, "transferring more than allowed");
        }
        try {
            await token.transferFrom(owner, user1, moreThenTotalSupply, {from: user1});
            assert(false);
        } catch (e) {
            expectRevert(e, "transferring more than the owner has");
        }
        try {
            await token.transferFrom(owner, '0x0', oneToken, {from: user1});
            assert(false);
        } catch (e) {
            expectRevert(e, "transferring to address(0) is not allowed");
        }
        assert(oneToken == (await token.balanceOf.call(user1)).toNumber(), "balance matches");
    });

    it("Increasing and decreasing approval works correctly", async () => {
        try {
          await token.increaseApproval(user1, oneToken, {from: user1});
          assert(false);
        } catch (e) {
            expectRevert(e, "increaseApproval shouldn't work before tokens are transferable");
        }

        try {
          await token.decreaseApproval(user1, oneToken, {from: user1});
          assert(false);
        } catch (e) {
            expectRevert(e, "decreaseApproval shouldn't work before tokens are transferable");
        }

        await token.enableTransfers();
        await token.approve(user1, oneToken);
        assert(oneToken == (await token.allowance.call(owner, user1)).toNumber());

        await token.increaseApproval(user1, oneToken);
        assert(twoTokens == (await token.allowance.call(owner, user1)).toNumber());

        await token.decreaseApproval(user1, oneToken);
        assert(oneToken == (await token.allowance.call(owner, user1)).toNumber());

        await token.decreaseApproval(user1, twoTokens);
        assert(0 == (await token.allowance.call(owner, user1)).toNumber());
    });

    it("Anyone can burn tokens", async () => {
        await token.transfer(user1, twoTokens, {from: owner});

        try {
            await token.burn(oneToken, {from: user1});
            assert(false);
        } catch (e) {
            expectRevert(e, "burn shouldn't work before tokens are transferable");
        }

        await token.enableTransfers();
        await token.burn(oneToken, {from: owner});
        await token.burn(oneToken, {from: user1});
        try {
            await token.burn(twoTokens, {from: user1});
            assert(false);
        } catch (e) {
            expectRevert(e, "trying to burn more then the user has");
        }
        assert(oneToken == (await token.balanceOf.call(user1)).toNumber());
    });

    it("Token refuses to accept ether transfers", async () => {
        var tx = {from: owner, to: token.address, value: 10000};
        try {
            await web3.eth.sendTransaction(tx);
            assert(false);
        } catch (e) {
            expectRevert(e, "token doesn't accept ether");
        }
    });

    it("Only owner can withdraw arbitrary tokens sent to this smart contract", async () => {
        let otherTokentoken = await DexBrokerageToken.new();

        await otherTokentoken.enableTransfers();
        await otherTokentoken.transfer(token.address, oneToken, {from: owner});

        try {
            await token.withdrawERC20Tokens(otherTokentoken.address, {from: user1});
            assert(false);
        } catch (e) {
            expectRevert(e, "only owner can execute this");
        }

        await token.withdrawERC20Tokens(otherTokentoken.address, {from: owner});
        assert(0 == (await otherTokentoken.balanceOf.call(token.address)).toNumber());

        try {
            await token.withdrawERC20Tokens(otherTokentoken.address, {from: owner});
            assert(false);
        } catch (e) {
            expectRevert(e, "withdrawing fails when zero balance");
        }
    });

    it("ApproveAndCall works correctly", async () => {
        let mock = await ApproveAndCallMock.new();
        let failingMock = await DexBrokerageToken.new();

        try {
          await token.approveAndCall(mock.address, oneToken, '0x0', {from: user1});
          assert(false);
        } catch (e) {
            expectRevert(e, "approveAndCall shouldn't work before tokens are transferable");
        }

        await token.enableTransfers();
        assert(await token.approveAndCall(mock.address, oneToken, '0x0'));

        assert(oneToken == (await mock.amount.call()).toNumber(), "amount matches");
        assert(owner == await mock.from.call(), "from matches");
        assert(token.address == await mock.tokenContract.call(), "token matches");

        try {
            await token.approveAndCall(failingMock.address, oneToken, '0x0');
            assert(false);
        } catch (e) {
            expectRevert(e, "token doesn't implement token fallback");
        }
    });

    it("Emergency ether withdrawal works", async () => {
        try {
            await token.withdrawEther({from: owner});
            assert(false);
        } catch (e) {
            expectRevert(e, "token balance is 0 so can't withdraw");
        }
        let etherForcer = await EtherForcer.new({value: 10000});
        assert(10000 == (await web3.eth.getBalance(etherForcer.address)).toNumber());
        await etherForcer.forceEther(token.address);
        assert(10000 == (await web3.eth.getBalance(token.address)).toNumber(), "injected some ether");
        try {
            await token.withdrawEther({from: user1});
            assert(false);
        } catch (e) {
            expectRevert(e, "only owner can call");
        }
        await token.withdrawEther({from: owner});
        assert(0 == (await web3.eth.getBalance(token.address)).toNumber(), "empty");
    });

    it("Can transfer ownership works as expected", async () => {
        assert(await token.transferOwnership(user1), "transfer ownership");
        assert(user1 == await token.owner.call(), "new owner");
        assert(!(await token.transferGrants.call(user1)), "doesnt' have transfer right");
        //can call 'onlyOwner' function
        await token.grantTransferRight(user1, {from: user1});
        assert(await token.transferGrants.call(user1), 'granted transfer right');

        //old owner stopped being owner and can no longer call 'onlyOwner' functions
        assert(owner != await token.owner.call(), "old owner");
        try {
            await token.grantTransferRight(user1, {from: owner});
            assert(false);
        } catch (e) {
            expectRevert(e, "old owner is no longer the owner");
        }

        try {
            await token.transferOwnership('0x0', {from: user1});
            assert(false);
        } catch (e) {
            expectRevert(e, "cannot transferOwnership to address(0)");
        }
    });
});
