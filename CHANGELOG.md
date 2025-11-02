# Changelog

All notable changes to the KubeMCP project will be documented in this file.

## [1.0.0] - 2025-10-30

### Added
- Initial release of KubeMCP server
- Comprehensive Kubernetes resource management tools:
  - Deployments (list, get, scale, restart, status)
  - Pods (list, get, delete, logs, status)
  - Services (list, get, endpoints)
  - ConfigMaps (full CRUD operations)
  - Secrets (full CRUD operations with secure handling)
  - Namespaces (list, create, delete)
  - Metrics (pod, node, deployment resource usage)
  - Events (monitoring and troubleshooting)
- Dual kubeconfig mode support (local and multipass)
- Environment-based configuration
- Comprehensive error handling
- TypeScript with strict type checking
- ESLint and Prettier for code quality
- Jest testing framework
- Detailed documentation

### Features
- MCP SDK integration for Cursor IDE
- Kubernetes JavaScript client for API interaction
- Dynamic kubeconfig loading from Multipass VMs
- Real-time metrics retrieval
- Event monitoring capabilities
- Secure secret management

### Developer Experience
- Hot reload in development mode
- Comprehensive test coverage
- Pre-commit hooks with Husky
- Type-safe implementations
- Clear error messages

