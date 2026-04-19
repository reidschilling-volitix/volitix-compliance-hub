import { auth } from '../firebase.js';

const requireEndpoint = (value, label) => {
  const endpoint = String(value || '').trim();
  if (!endpoint) {
    throw new Error(`${label} is not configured. Set it in .env as ${label}.`);
  }
  return endpoint;
};

const postForUrl = async (endpoint, payload) => {
  const token = await auth.currentUser?.getIdToken?.();
  if (!token) {
    throw new Error('You must be signed in to manage billing.');
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed (${response.status}).`);
  }

  const data = await response.json();
  if (!data?.url) {
    throw new Error('No redirect URL returned by billing endpoint.');
  }

  return data.url;
};

export const startStripeCheckout = async ({ tenantId, email, plan, droneCount }) => {
  const endpoint = requireEndpoint(import.meta.env.VITE_STRIPE_CHECKOUT_ENDPOINT, 'VITE_STRIPE_CHECKOUT_ENDPOINT');
  const url = await postForUrl(endpoint, {
    tenantId,
    email,
    plan,
    droneCount,
    successUrl: window.location.href,
    cancelUrl: window.location.href,
  });
  window.location.assign(url);
};

export const openStripePortal = async ({ tenantId, email }) => {
  const endpoint = requireEndpoint(import.meta.env.VITE_STRIPE_PORTAL_ENDPOINT, 'VITE_STRIPE_PORTAL_ENDPOINT');
  const url = await postForUrl(endpoint, {
    tenantId,
    email,
    returnUrl: window.location.href,
  });
  window.location.assign(url);
};
