/* eslint-disable @typescript-eslint/no-explicit-any */
// IDL normalizer to handle primitive string types vs object types mismatch
// This fixes the "Cannot use 'in' operator to search for 'option' in publicKey" error

type Idl = any;

export function normalizeIdlTypes(idl: Idl): Idl {
  const convert = (t: any): any => {
    if (typeof t === "string") {
      // Keep publicKey as a string - it's a primitive type, not a defined type
      if (t === "publicKey") {
        console.log('Keeping publicKey as primitive string');
        return t;
      }
      // Keep other primitive types as strings
      return t;
    }
    if (t && typeof t === "object") {
      if ("option" in t) return { option: convert(t.option) };
      if ("vec" in t) return { vec: convert(t.vec) };
      if ("array" in t) return { array: [convert(t.array[0]), t.array[1]] };
      if ("defined" in t) return { defined: t.defined };
      if ("fields" in t) return { ...t, fields: t.fields.map((f: any) => ({ ...f, type: convert(f.type) })) };
      if ("variants" in t) return { 
        ...t, 
        variants: t.variants.map((v: any) => (
          "fields" in v ? { ...v, fields: v.fields.map((f: any) => convert(f)) } : v
        ))
      };
      return Object.fromEntries(Object.entries(t).map(([k, v]) => [k, convert(v)]));
    }
    return t;
  };

  const clone = JSON.parse(JSON.stringify(idl));
  
  console.log('Original IDL sample:', {
    accounts: clone.accounts?.[0]?.type?.fields?.slice(0, 2),
    types: clone.types?.[0]?.type?.fields?.slice(0, 2)
  });
  
  // Convert account types
  if (Array.isArray(clone.accounts)) {
    clone.accounts.forEach((a: any) => a.type = convert(a.type));
  }
  
  // Convert type definitions
  if (Array.isArray(clone.types)) {
    clone.types.forEach((t: any) => t.type = convert(t.type));
  }
  
  // Convert instruction args
  if (Array.isArray(clone.instructions)) {
    clone.instructions.forEach((ix: any) => {
      // args may contain complex types too
      ix.args = ix.args?.map((arg: any) => ({ ...arg, type: convert(arg.type) })) ?? [];
    });
  }
  
  console.log('Normalized IDL sample:', {
    accounts: clone.accounts?.[0]?.type?.fields?.slice(0, 2),
    types: clone.types?.[0]?.type?.fields?.slice(0, 2)
  });
  
  return clone;
}
