// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

/// @title RigShift - On-chain shift tracking with USDC rewards
/// @notice Workers clock in/out; foreman distributes USDC per closed shift
contract RigShift {
    uint256 public constant REWARD_PER_SHIFT = 300_000; // 0.30 USDC (6 decimals)
    address public constant USDC = 0x3600000000000000000000000000000000000000;

    address public foreman;

    struct Worker {
        uint256 shiftStart;      // 0 = not clocked in
        uint256 shiftsCompleted; // total closed shifts
        uint256 shiftsPaid;      // shifts already rewarded
    }

    mapping(address => Worker) public workers;
    address[] public workerList;
    mapping(address => bool) private registered;

    uint256 public totalShiftsClosed;
    uint256 public totalUSDCDistributed;

    event ClockedIn(address indexed worker, uint256 timestamp);
    event ClockedOut(address indexed worker, uint256 duration);
    event RewardsDistributed(address indexed worker, uint256 amount, uint256 shifts);
    event ForemanTransferred(address indexed oldForeman, address indexed newForeman);

    error AlreadyClockedIn();
    error NotClockedIn();
    error OnlyForeman();
    error InsufficientPool();

    modifier onlyForeman() {
        if (msg.sender != foreman) revert OnlyForeman();
        _;
    }

    constructor() {
        foreman = msg.sender;
    }

    /// @notice Start a new shift
    function clockIn() external {
        Worker storage w = workers[msg.sender];
        if (w.shiftStart != 0) revert AlreadyClockedIn();
        w.shiftStart = block.timestamp;
        if (!registered[msg.sender]) {
            registered[msg.sender] = true;
            workerList.push(msg.sender);
        }
        emit ClockedIn(msg.sender, block.timestamp);
    }

    /// @notice End the current shift
    function clockOut() external {
        Worker storage w = workers[msg.sender];
        if (w.shiftStart == 0) revert NotClockedIn();
        uint256 duration = block.timestamp - w.shiftStart;
        w.shiftStart = 0;
        w.shiftsCompleted += 1;
        totalShiftsClosed += 1;
        emit ClockedOut(msg.sender, duration);
    }

    /// @notice Distribute USDC rewards for all unpaid closed shifts
    function distributeRewards() external onlyForeman {
        uint256 len = workerList.length;
        for (uint256 i = 0; i < len; ) {
            address addr = workerList[i];
            Worker storage w = workers[addr];
            uint256 unpaid = w.shiftsCompleted - w.shiftsPaid;
            if (unpaid > 0) {
                uint256 amount = unpaid * REWARD_PER_SHIFT;
                uint256 poolBal = IERC20(USDC).balanceOf(address(this));
                if (poolBal < amount) revert InsufficientPool();
                w.shiftsPaid += unpaid;
                totalUSDCDistributed += amount;
                IERC20(USDC).transfer(addr, amount);
                emit RewardsDistributed(addr, amount, unpaid);
            }
            unchecked { ++i; }
        }
    }

    /// @notice Distribute rewards for a single worker
    function distributeRewardTo(address worker) external onlyForeman {
        Worker storage w = workers[worker];
        uint256 unpaid = w.shiftsCompleted - w.shiftsPaid;
        if (unpaid == 0) return;
        uint256 amount = unpaid * REWARD_PER_SHIFT;
        uint256 poolBal = IERC20(USDC).balanceOf(address(this));
        if (poolBal < amount) revert InsufficientPool();
        w.shiftsPaid += unpaid;
        totalUSDCDistributed += amount;
        IERC20(USDC).transfer(worker, amount);
        emit RewardsDistributed(worker, amount, unpaid);
    }

    function transferForeman(address newForeman) external onlyForeman {
        emit ForemanTransferred(foreman, newForeman);
        foreman = newForeman;
    }

    function getWorkerInfo(address worker)
        external
        view
        returns (
            bool clockedIn,
            uint256 shiftStart,
            uint256 shiftsCompleted,
            uint256 shiftsPaid,
            uint256 unpaidShifts
        )
    {
        Worker storage w = workers[worker];
        clockedIn = w.shiftStart != 0;
        shiftStart = w.shiftStart;
        shiftsCompleted = w.shiftsCompleted;
        shiftsPaid = w.shiftsPaid;
        unpaidShifts = w.shiftsCompleted - w.shiftsPaid;
    }

    function getStats()
        external
        view
        returns (
            uint256 _totalShiftsClosed,
            uint256 _totalUSDCDistributed,
            uint256 _workerCount,
            uint256 _poolBalance
        )
    {
        _totalShiftsClosed = totalShiftsClosed;
        _totalUSDCDistributed = totalUSDCDistributed;
        _workerCount = workerList.length;
        _poolBalance = IERC20(USDC).balanceOf(address(this));
    }

    function workerCount() external view returns (uint256) {
        return workerList.length;
    }
}
