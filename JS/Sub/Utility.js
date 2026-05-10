// Utility functions
// NOTE: This file is not used in the current build (Script.js contains inline helpers).
// Keep for future modularization.

export const CSS = {
	// not used, but kept for compatibility
};

export function reveal(element) {
	element.classList.remove('hidden');
}

export function conceal(element) {
	element.classList.add('hidden');
}

export async function fetchJSON(url) {
	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(`Failed to fetch ${url}: ${response.status}`);
	}
	return await response.json();
}

export function lerp(a, b, t) {
	return a + (b - a) * t;
}

export function pushHash(hash) {
	window.location.hash = hash;
}

// Landing page entered state persistence with 30min expiry
const ENTERED_KEY = 'siteEntered';
const EXPIRY_KEY = 'enteredExpiry';

export function hasEnteredSite() {
  const entered = localStorage.getItem(ENTERED_KEY) === 'true';
  const expiryStr = localStorage.getItem(EXPIRY_KEY);
  if (entered && expiryStr) {
    const expiry = parseInt(expiryStr);
    if (Date.now() < expiry) {
      return true;
    }
  }
  // Clear expired
  localStorage.removeItem(ENTERED_KEY);
  localStorage.removeItem(EXPIRY_KEY);
  return false;
}

export function setEnteredSite() {
  const expiry = Date.now() + 30 * 60 * 1000; // 30 minutes
  localStorage.setItem(ENTERED_KEY, 'true');
  localStorage.setItem(EXPIRY_KEY, expiry.toString());
}

export function clearEnteredStorage() {
  localStorage.removeItem(ENTERED_KEY);
  localStorage.removeItem(EXPIRY_KEY);
}