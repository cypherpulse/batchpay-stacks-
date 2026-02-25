# BatchPay

BatchPay is a blockchain-based payment batching system built on the Stacks blockchain. It allows users to efficiently batch multiple payments into a single transaction, reducing costs and improving scalability.

## Features

- **Batch Payments**: Combine multiple payments into a single transaction.
- **Cost Efficiency**: Reduce transaction fees by batching payments.
- **Scalability**: Handle a large number of payments efficiently.
- **Secure**: Built on the Stacks blockchain, ensuring security and transparency.

## Prerequisites

Before you begin, ensure you have the following installed:

- [Node.js](https://nodejs.org/) (v16 or higher recommended)
- [Clarinet](https://github.com/hirosystems/clarinet) (for testing and deploying smart contracts)
- [Stacks Wallet](https://www.hiro.so/wallet) (for interacting with the blockchain)

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/your-repo/BatchPay.git
   cd BatchPay
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

## Usage

### Running Tests

To run the unit tests for the project:
```bash
npm test
```

For detailed test reports:
```bash
npm run test:report
```

To watch for changes and rerun tests automatically:
```bash
npm run test:watch
```

### Checking Contracts

Use Clarinet to check the contracts:
```bash
clarinet check
```

### Deploying Contracts

1. Configure the deployment settings in the `deployments/` folder.
2. Deploy the contracts using Clarinet:
   ```bash
   clarinet deploy
   ```

## Project Structure

- `contracts/`: Contains the Clarity smart contracts.
- `deployments/`: Deployment plans for different environments (e.g., testnet, mainnet).
- `settings/`: Configuration files for different environments.
- `tests/`: Unit tests for the smart contracts.

## Dependencies

This project uses the following dependencies:

- `@stacks/clarinet-sdk`: SDK for interacting with Clarinet.
- `@stacks/transactions`: Library for creating and signing Stacks transactions.
- `vitest`: A fast unit test framework.
- `vitest-environment-clarinet`: Environment for running tests with Clarinet.

## Contributing

Contributions are welcome! Please fork the repository and submit a pull request.

## License

This project is licensed under the ISC License. See the LICENSE file for details.

## Authors

- Your Name (Add your details here)

## Acknowledgments

- [Hiro Systems](https://www.hiro.so/) for Clarinet and Stacks development tools.
- The Stacks community for their support and contributions.