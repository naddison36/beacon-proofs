export const bytes = /^0x([A-Fa-f0-9]{1,})$/;

const bytesFixed = (x: number) => new RegExp(`^0x([A-Fa-f0-9]{${x * 2}})$`);

export const bytes4 = bytesFixed(4); // 32 bit
export const bytes8 = bytesFixed(8); // 64 bit
export const ethereumAddress = bytesFixed(20);
export const bytes32 = bytesFixed(32);
