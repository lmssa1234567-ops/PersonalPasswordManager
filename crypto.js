// crypto.js

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export async function deriveKey(passphrase, salt) {
  const baseKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(passphrase),
    { name: "PBKDF2" },
    false,
    ["deriveKey"],
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: 100000,
      hash: "SHA-256",
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function hashKey(passphrase, salt) {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(passphrase),
    { name: "PBKDF2" },
    false,
    ["deriveBits"],
  );

  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt,
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    256,
  );

  return btoa(String.fromCharCode(...new Uint8Array(bits)));
}

export async function encryptData(data, key) {
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoder.encode(JSON.stringify(data)),
  );

  return {
    iv: Array.from(iv),
    data: Array.from(new Uint8Array(encrypted)),
  };
}

export async function decryptData(encryptedObj, key) {
  const iv = new Uint8Array(encryptedObj.iv);
  const data = new Uint8Array(encryptedObj.data);

  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    data,
  );

  return JSON.parse(decoder.decode(decrypted));
}

export async function encryptString(value, key) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = encoder.encode(value);

  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoded,
  );

  return {
    iv: Array.from(iv),
    data: Array.from(new Uint8Array(encrypted)),
  };
}

export async function decryptString(encryptedObj, key) {
  const iv = new Uint8Array(encryptedObj.iv);
  const data = new Uint8Array(encryptedObj.data);

  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    data,
  );

  return decoder.decode(decrypted);
}
