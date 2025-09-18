# Crypto Trader DB

TypeScript package for MongoDB database utilities in the crypto trader bot project.

## Status

This package is currently set up as a TypeScript foundation. MongoDB-related functionality will be implemented based on specific requirements.

## Current Structure

- **TypeScript Configuration**: Ready for development with strict typing
- **Build System**: Configured with TypeScript compiler
- **Type Definitions**: Basic types defined in `src/types.ts`
- **Package Structure**: Follows modern npm package conventions

## Development

### Install Dependencies

```bash
npm install
```

### Build

```bash
npm run build
```

### Watch Mode (for development)

```bash
npm run dev
```

### Clean Build Directory

```bash
npm run clean
```

## Building from Root

You can build this package from the project root using:

```bash
npm run build        # Builds crypto-trader-db package
npm run build:db     # Alternative command to build crypto-trader-db package
```

## Next Steps

When ready to implement MongoDB functionality:

1. Add MongoDB driver as dependency
2. Define specific data models and schemas
3. Implement database connection and operations
4. Add comprehensive types for trading data structures
