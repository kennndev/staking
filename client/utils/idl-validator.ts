// IDL validator to check if the IDL structure is correct

interface IDLInstruction {
  name: string;
  accounts?: unknown[];
  args?: unknown[];
}

interface IDLAccount {
  name: string;
  type: {
    fields?: unknown[];
  };
}

interface IDLType {
  name: string;
  type: unknown;
}

interface IDL {
  version?: string;
  name?: string;
  address?: string;
  instructions?: IDLInstruction[];
  accounts?: IDLAccount[];
  types?: IDLType[];
}

export function validateIDL(idl: IDL): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Check required top-level fields
  if (!idl.version) errors.push('Missing version field');
  if (!idl.name) errors.push('Missing name field');
  if (!idl.address) errors.push('Missing address field');
  if (!idl.instructions) errors.push('Missing instructions field');
  if (!idl.accounts) errors.push('Missing accounts field');
  
  // Check instructions
  if (idl.instructions && Array.isArray(idl.instructions)) {
    idl.instructions.forEach((ix: IDLInstruction, index: number) => {
      if (!ix.name) errors.push(`Instruction ${index} missing name`);
      if (!ix.accounts) errors.push(`Instruction ${ix.name} missing accounts`);
      if (!ix.args) errors.push(`Instruction ${ix.name} missing args`);
    });
  }
  
  // Check accounts
  if (idl.accounts && Array.isArray(idl.accounts)) {
    idl.accounts.forEach((account: IDLAccount, index: number) => {
      if (!account.name) errors.push(`Account ${index} missing name`);
      if (!account.type) errors.push(`Account ${account.name} missing type`);
      if (!account.type.fields) errors.push(`Account ${account.name} missing fields`);
    });
  }
  
  // Check types
  if (idl.types && Array.isArray(idl.types)) {
    idl.types.forEach((type: IDLType, index: number) => {
      if (!type.name) errors.push(`Type ${index} missing name`);
      if (!type.type) errors.push(`Type ${type.name} missing type definition`);
    });
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}
