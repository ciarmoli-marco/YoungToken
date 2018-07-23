pragma solidity ^0.4.17;
import "../node_modules/zeppelin-solidity/contracts/token/ERC20/StandardToken.sol";
import "../node_modules/zeppelin-solidity/contracts/token/ERC20/TokenTimelock.sol";
import "./Authorizable.sol";

contract YoungToken is  StandardToken, Authorizable {
    
    // token name
    string public name = "Young";

    // token short name
    string public symbol = "YNG";

    // token decimals - Example : min transaction with 4 decimals is -> 0.0001 YNG
    uint8 public decimals = 4;

    // total supply for young token
    uint256 public cap;

    // percentage intendeed for development team
    uint8 public teamPercentage = 10;

    // percentage intendeed for advisors
    uint8 public advisorsPercentage = 5;

    // is entire total supply minted ?
    bool public mintingFinished = false;

    // is entire team supply minted?
    bool public teamTokenMinted = false;

    // can this address mint tokens?
    modifier canMint() {
        require(!mintingFinished);
        _;
    }
    
    // event for remaining token burn (after second ico phase)
    event Burn(address indexed burner, uint256 value);

    // event for token mint
    event Mint(address indexed to, uint256 amount);

    // event to close mint after total supply reached
    event MintFinished();

    /**
    *
    * Young Token constructor
    * params _advisorAddress -> Address to send 'advisorsPercentage' tokens
    *         _cap             -> Total token supply (maybe 100 millions)
    *
    **/
    function YoungToken(address _advisorsAddress, uint256 _cap) public {
        require(_cap > 0);
        cap = _cap*uint(10)**decimals;
        totalSupply_ = 0;
        uint256 advisorsTokens = (cap * advisorsPercentage) / 100;
        mint(_advisorsAddress, advisorsTokens);
    }

    /**
    *
    * Mint and lock 'teamPercentage' tokens
    * params _to -> Address to send 'teamPercentage' tokens
    *
    * info : 'teamTokenMinted' should be false (Means that team tokens aren't already minted)
    *          This function also lock team tokens for 24 weeks ( 6 months )
    *
    **/
    function mintLockTeamTokens(address _to) public onlyOwner canMint returns (TokenTimelock) {
        // Mint and send team tokens to the time lock. Tokens are locked for 6 months
        require(!teamTokenMinted);
        uint256 teamTokens = (cap * teamPercentage) / 100;
        TokenTimelock teamLock = new TokenTimelock(this, _to, now + 24 weeks);
        mint(teamLock, teamTokens);
        teamTokenMinted = true;
        return teamLock;
    }

    /**
    *
    * Token burn funtion
    * params _value -> Amount of tokens to burn
    *
    * info : Require value <= balance of request sender
    *
    * devs : Maybe this function should be onlyOwner ? 
    *
    **/
    function burn(uint256 _value) public {
        require(_value <= balances[msg.sender]);
        address burner = msg.sender;
        balances[burner] = balances[burner].sub(_value);
        totalSupply_ = totalSupply_.sub(_value);
        cap = cap.sub(_value);
        Burn(burner, _value);
    }

    /**
    *
    * Token mint function
    * params _to     -> Address to send minted tokens
    *         _amount -> Amount of tokens to burn
    *
    * info : Cannot exceed totalSupply
    *
    **/
    function mint(address _to, uint256 _amount) onlyAuthorized canMint public returns (bool) {
        require(totalSupply_.add(_amount) <= cap);
        totalSupply_ = totalSupply_.add(_amount);
        balances[_to] = balances[_to].add(_amount);
        Mint(_to, _amount);
        Transfer(address(0), _to, _amount);
        return true;
    }

    /**
    *
    * Finalize token minting ( after that minting will not possible )
    *
    **/
    function finishMinting() onlyOwner canMint public returns (bool) {
        mintingFinished = true;
        MintFinished();
        return true;
    }

}