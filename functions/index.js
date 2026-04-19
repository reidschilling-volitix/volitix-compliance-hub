const functions = require('firebase-functions');
const { onRequest } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const Stripe = require('stripe');
const { COUNTY_PARCELS, STATE_PARCELS } = require('./countyParcels');

admin.initializeApp();

const APP_ARTIFACT_ID = process.env.APP_ARTIFACT_ID || 'aviation-compliance-hub';
const ALLOWED_ORIGINS = ['http://localhost:5173', 'https://localhost:5173'];
const stripeSecretBindings = ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET'];

const getStripe = () => {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error('Stripe secret key is not configured.');
  }
  return new Stripe(key);
};

const getBasePriceId = () => {
  return (
    process.env.STRIPE_PRICE_BASE ||
    process.env.STRIPE_PRICE_STARTER ||
    ''
  );
};

const getAddonDronePriceId = () => {
  return (
    process.env.STRIPE_PRICE_ADDON_DRONE ||
    ''
  );
};

const getWebhookSecret = () => {
  return process.env.STRIPE_WEBHOOK_SECRET || '';
};

const subscriptionDocRef = (tenantId) => admin
  .firestore()
  .doc(`artifacts/${APP_ARTIFACT_ID}/public/data/saas_subscriptions/${tenantId}`);

const subscriptionCollectionRef = () => admin
  .firestore()
  .collection(`artifacts/${APP_ARTIFACT_ID}/public/data/saas_subscriptions`);

const readTenantIdFromObject = (obj) => {
  const fromMetadata = String(obj?.metadata?.tenantId || '').trim();
  if (fromMetadata) return fromMetadata;
  const fromClientReference = String(obj?.client_reference_id || '').trim();
  if (fromClientReference) return fromClientReference;
  return '';
};

const fetchCustomerById = async (stripe, customerId) => {
  const id = String(customerId || '').trim();
  if (!id) return null;
  try {
    return await stripe.customers.retrieve(id);
  } catch (_err) {
    return null;
  }
};

const findTenantIdByStripeCustomerId = async (customerId) => {
  const id = String(customerId || '').trim();
  if (!id) return '';

  const snap = await subscriptionCollectionRef()
    .where('stripeCustomerId', '==', id)
    .limit(1)
    .get();

  if (snap.empty) return '';

  const docSnap = snap.docs[0];
  const data = docSnap.data() || {};
  return String(data.tenantId || docSnap.id || '').trim();
};

const resolveTenantIdForStripeObject = async ({ stripe, obj, customerId }) => {
  const direct = readTenantIdFromObject(obj);
  if (direct) return direct;

  const normalizedCustomerId = String(customerId || obj?.customer || '').trim();
  if (normalizedCustomerId) {
    const customer = await fetchCustomerById(stripe, normalizedCustomerId);
    const fromCustomerMetadata = String(customer?.metadata?.tenantId || '').trim();
    if (fromCustomerMetadata) return fromCustomerMetadata;

    const fromSubscriptions = await findTenantIdByStripeCustomerId(normalizedCustomerId);
    if (fromSubscriptions) return fromSubscriptions;
  }

  return '';
};

const toIsoFromUnix = (value) => {
  const unix = Number(value);
  if (!Number.isFinite(unix) || unix <= 0) return '';
  return new Date(unix * 1000).toISOString();
};

const calculateExtraDroneQty = (subscription) => {
  const items = subscription?.items?.data || [];
  if (!Array.isArray(items) || items.length === 0) return 0;

  const addonPriceId = getAddonDronePriceId();
  if (addonPriceId) {
    const addonLine = items.find((item) => item?.price?.id === addonPriceId);
    const qty = Number(addonLine?.quantity || 0);
    return Number.isFinite(qty) && qty > 0 ? Math.floor(qty) : 0;
  }

  const basePriceId = getBasePriceId();
  if (!basePriceId) return 0;

  const nonBaseQty = items
    .filter((item) => item?.price?.id !== basePriceId)
    .reduce((total, item) => total + (Number(item?.quantity || 0) || 0), 0);
  return Math.max(0, Math.floor(nonBaseQty));
};

const syncSubscriptionToFirestore = async ({ tenantId, subscription, customer, stripeCustomerId }) => {
  const resolvedTenantId = String(tenantId || '').trim();
  if (!resolvedTenantId) return;

  const ref = subscriptionDocRef(resolvedTenantId);
  const existingSnap = await ref.get();
  const existing = existingSnap.exists ? existingSnap.data() || {} : {};

  const extraDrones = calculateExtraDroneQty(subscription);
  const includedDrones = 2;
  const nextStripeCustomerId = String(
    stripeCustomerId || customer?.id || subscription?.customer || existing.stripeCustomerId || ''
  ).trim();
  const billingEmail = String(customer?.email || existing.billingEmail || '').trim();

  await ref.set(
    {
      tenantId: resolvedTenantId,
      plan: 'base',
      pricingModel: 'base-2-plus-10-per-extra-drone',
      status: String(subscription?.status || existing.status || 'trialing'),
      billingEmail,
      stripeCustomerId: nextStripeCustomerId,
      stripeSubscriptionId: String(subscription?.id || existing.stripeSubscriptionId || '').trim(),
      includedDrones,
      extraDrones,
      droneCount: includedDrones + extraDrones,
      cancelAtPeriodEnd: Boolean(subscription?.cancel_at_period_end),
      currentPeriodStart: toIsoFromUnix(subscription?.current_period_start),
      currentPeriodEnd: toIsoFromUnix(subscription?.current_period_end),
      canceledAt: toIsoFromUnix(subscription?.canceled_at),
      endedAt: toIsoFromUnix(subscription?.ended_at),
      createdAt: existing.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );
};

const syncBySubscriptionId = async ({ stripe, subscriptionId, tenantIdHint, customerIdHint }) => {
  const id = String(subscriptionId || '').trim();
  if (!id) return;

  const subscription = await stripe.subscriptions.retrieve(id);
  const customerId = String(customerIdHint || subscription?.customer || '').trim();
  const customer = await fetchCustomerById(stripe, customerId);

  const tenantId = String(tenantIdHint || '').trim() || await resolveTenantIdForStripeObject({
    stripe,
    obj: subscription,
    customerId,
  });

  if (!tenantId) return;

  await syncSubscriptionToFirestore({
    tenantId,
    subscription,
    customer,
    stripeCustomerId: customerId,
  });
};

const processStripeWebhookEvent = async ({ stripe, event }) => {
  const type = String(event?.type || '');
  const obj = event?.data?.object || {};

  if (type === 'checkout.session.completed') {
    await syncBySubscriptionId({
      stripe,
      subscriptionId: obj?.subscription,
      tenantIdHint: readTenantIdFromObject(obj),
      customerIdHint: obj?.customer,
    });
    return;
  }

  if (
    type === 'customer.subscription.created' ||
    type === 'customer.subscription.updated' ||
    type === 'customer.subscription.deleted'
  ) {
    await syncBySubscriptionId({
      stripe,
      subscriptionId: obj?.id,
      tenantIdHint: readTenantIdFromObject(obj),
      customerIdHint: obj?.customer,
    });
    return;
  }

  if (type === 'invoice.payment_succeeded' || type === 'invoice.payment_failed') {
    await syncBySubscriptionId({
      stripe,
      subscriptionId: obj?.subscription,
      customerIdHint: obj?.customer,
    });
  }
};

const setCors = (req, res) => {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.set('Access-Control-Allow-Origin', origin);
  } else {
    res.set('Access-Control-Allow-Origin', '*');
  }
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
};

const requirePost = (req, res) => {
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return false;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return false;
  }
  return true;
};

const parseBearerToken = (req) => {
  const authHeader = String(req.headers.authorization || '');
  if (!authHeader.startsWith('Bearer ')) return '';
  return authHeader.slice('Bearer '.length).trim();
};

const getUserAndTenant = async (req) => {
  const token = parseBearerToken(req);
  if (!token) {
    throw new Error('Missing auth token');
  }

  const decoded = await admin.auth().verifyIdToken(token);
  const profileRef = admin
    .firestore()
    .doc(`artifacts/${APP_ARTIFACT_ID}/public/data/saas_users/${decoded.uid}`);
  const profileSnap = await profileRef.get();
  if (!profileSnap.exists) {
    throw new Error('User profile not found');
  }
  const profile = profileSnap.data() || {};
  const tenantId = String(profile.tenantId || '').trim();
  if (!tenantId) {
    throw new Error('User tenant is missing');
  }

  return {
    uid: decoded.uid,
    email: decoded.email || profile.email || '',
    role: profile.role || '',
    tenantId,
  };
};

const loadOrCreateStripeCustomer = async ({ stripe, tenantId, email }) => {
  const subRef = admin
    .firestore()
    .doc(`artifacts/${APP_ARTIFACT_ID}/public/data/saas_subscriptions/${tenantId}`);
  const subSnap = await subRef.get();
  const subData = subSnap.exists ? subSnap.data() || {} : {};

  if (subData.stripeCustomerId) {
    return { stripeCustomerId: subData.stripeCustomerId, subRef };
  }

  const customer = await stripe.customers.create({
    email: email || undefined,
    metadata: { tenantId },
  });

  await subRef.set(
    {
      tenantId,
      stripeCustomerId: customer.id,
      billingEmail: email || '',
      updatedAt: new Date().toISOString(),
      createdAt: subData.createdAt || new Date().toISOString(),
      plan: subData.plan || 'starter',
      status: subData.status || 'trialing',
    },
    { merge: true }
  );

  return { stripeCustomerId: customer.id, subRef };
};

exports.createStripeCheckoutSession = onRequest({ secrets: stripeSecretBindings }, async (req, res) => {
  setCors(req, res);
  if (!requirePost(req, res)) return;

  try {
    const stripe = getStripe();
    const user = await getUserAndTenant(req);
    if (user.role !== 'Manager') {
      return res.status(403).json({ error: 'Only managers can manage billing.' });
    }

    const tenantId = String(req.body?.tenantId || '').trim();
    if (!tenantId || tenantId !== user.tenantId) {
      return res.status(403).json({ error: 'Tenant mismatch.' });
    }

    const basePriceId = getBasePriceId();
    if (!basePriceId) {
      return res.status(400).json({ error: 'No Stripe base price is configured.' });
    }

    const rawDroneCount = Number(req.body?.droneCount);
    const droneCount = Number.isFinite(rawDroneCount) && rawDroneCount > 0 ? Math.floor(rawDroneCount) : 0;
    const includedDrones = 2;
    const extraDroneQty = Math.max(0, droneCount - includedDrones);
    const addonDronePriceId = getAddonDronePriceId();

    if (extraDroneQty > 0 && !addonDronePriceId) {
      return res.status(400).json({
        error: 'Extra drone price is not configured (STRIPE_PRICE_ADDON_DRONE).',
      });
    }

    const successUrl = String(req.body?.successUrl || '').trim();
    const cancelUrl = String(req.body?.cancelUrl || '').trim();
    if (!successUrl || !cancelUrl) {
      return res.status(400).json({ error: 'successUrl and cancelUrl are required.' });
    }

    const { stripeCustomerId } = await loadOrCreateStripeCustomer({
      stripe,
      tenantId,
      email: String(req.body?.email || user.email || '').trim(),
    });

    const lineItems = [{ price: basePriceId, quantity: 1 }];
    if (extraDroneQty > 0) {
      lineItems.push({ price: addonDronePriceId, quantity: extraDroneQty });
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: stripeCustomerId,
      line_items: lineItems,
      success_url: successUrl,
      cancel_url: cancelUrl,
      client_reference_id: tenantId,
      metadata: {
        tenantId,
        requestedBy: user.uid,
        plan: 'base',
        pricingModel: 'base-2-plus-10-per-extra-drone',
        droneCount: String(droneCount),
        includedDrones: String(includedDrones),
        extraDrones: String(extraDroneQty),
      },
    });

    return res.status(200).json({ url: session.url });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Failed to create checkout session.' });
  }
});

exports.createStripeBillingPortalSession = onRequest({ secrets: stripeSecretBindings }, async (req, res) => {
  setCors(req, res);
  if (!requirePost(req, res)) return;

  try {
    const stripe = getStripe();
    const user = await getUserAndTenant(req);
    if (user.role !== 'Manager') {
      return res.status(403).json({ error: 'Only managers can manage billing.' });
    }

    const tenantId = String(req.body?.tenantId || '').trim();
    if (!tenantId || tenantId !== user.tenantId) {
      return res.status(403).json({ error: 'Tenant mismatch.' });
    }

    const returnUrl = String(req.body?.returnUrl || '').trim();
    if (!returnUrl) {
      return res.status(400).json({ error: 'returnUrl is required.' });
    }

    const { stripeCustomerId } = await loadOrCreateStripeCustomer({
      stripe,
      tenantId,
      email: String(req.body?.email || user.email || '').trim(),
    });

    const session = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: returnUrl,
    });

    return res.status(200).json({ url: session.url });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Failed to create billing portal session.' });
  }
});

exports.handleStripeWebhook = onRequest({ secrets: stripeSecretBindings }, async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).send('Method not allowed');
  }

  const stripe = getStripe();
  const webhookSecret = getWebhookSecret();
  if (!webhookSecret) {
    return res.status(500).json({ error: 'Stripe webhook secret is not configured.' });
  }

  const signature = String(req.headers['stripe-signature'] || '').trim();
  if (!signature) {
    return res.status(400).json({ error: 'Missing Stripe signature header.' });
  }

  if (!req.rawBody) {
    return res.status(400).json({ error: 'Missing raw request body for signature verification.' });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.rawBody, signature, webhookSecret);
  } catch (err) {
    return res.status(400).json({ error: `Webhook signature verification failed: ${err.message}` });
  }

  try {
    await processStripeWebhookEvent({ stripe, event });
    return res.status(200).json({ received: true });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Failed to process webhook event.' });
  }
});

// ---- Field Boundary Proxy ----
// Looks up county FIPS from lat/lng via FCC API, then queries the county's
// public parcel GIS endpoint. Falls back to USDA CSB if no parcel data.

const FCC_AREA_URL = 'https://geo.fcc.gov/api/census/area';

// CSB years to cascade through (newest first)
const CSB_YEARS = [
  { year: 2022, crop: 'r22' },
  { year: 2021, crop: 'r21' },
  { year: 2020, crop: 'r20' },
];

const buildEnvelope = (lat, lng, size) =>
  `${lng - size},${lat - size},${lng + size},${lat + size}`;

// Point-in-polygon ray-cast for ArcGIS rings [[lon,lat],...]
const pointInRing = (lng, lat, ring) => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1];
    const xj = ring[j][0], yj = ring[j][1];
    if ((yi > lat) !== (yj > lat) && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
};

// Douglas-Peucker simplification for ArcGIS rings [[lon,lat],...]
const simplifyRing = (ring, tolerance = 0.00002) => {
  if (ring.length <= 4) return ring;
  const perpDist = (p, a, b) => {
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const mag = Math.sqrt(dx * dx + dy * dy);
    if (mag === 0) return Math.sqrt((p[0] - a[0]) ** 2 + (p[1] - a[1]) ** 2);
    return Math.abs(dx * (a[1] - p[1]) - dy * (a[0] - p[0])) / mag;
  };
  const dp = (pts, start, end) => {
    let maxD = 0, idx = start;
    for (let i = start + 1; i < end; i++) {
      const d = perpDist(pts[i], pts[start], pts[end]);
      if (d > maxD) { maxD = d; idx = i; }
    }
    if (maxD > tolerance) {
      const left = dp(pts, start, idx);
      const right = dp(pts, idx, end);
      return [...left.slice(0, -1), ...right];
    }
    return [pts[start], pts[end]];
  };
  const simplified = dp(ring, 0, ring.length - 1);
  if (
    simplified.length >= 3 &&
    (simplified[0][0] !== simplified[simplified.length - 1][0] ||
      simplified[0][1] !== simplified[simplified.length - 1][1])
  ) {
    simplified.push([...simplified[0]]);
  }
  return simplified.length >= 4 ? simplified : ring;
};

// Pick the best feature from a list (prefers containment, then closest centroid)
const pickBestFeature = (features, lat, lng) => {
  // 1) Prefer feature whose ring contains the click point
  for (const f of features) {
    if (f.geometry?.rings?.[0] && pointInRing(lng, lat, f.geometry.rings[0])) {
      return f;
    }
  }
  // 2) Closest centroid
  let best = features[0], bestDist = Infinity;
  for (const f of features) {
    const ring = f.geometry?.rings?.[0];
    if (!ring) continue;
    const cLon = ring.reduce((s, p) => s + p[0], 0) / ring.length;
    const cLat = ring.reduce((s, p) => s + p[1], 0) / ring.length;
    const d = Math.sqrt((cLat - lat) ** 2 + (cLon - lng) ** 2);
    if (d < bestDist) { bestDist = d; best = f; }
  }
  return best;
};

// Query an ArcGIS endpoint with envelope geometry
const queryArcGIS = async (baseUrl, envelope, outFields = '*', maxRecords = 10) => {
  const params = new URLSearchParams({
    geometry: envelope,
    geometryType: 'esriGeometryEnvelope',
    spatialRel: 'esriSpatialRelIntersects',
    outFields,
    returnGeometry: 'true',
    f: 'json',
    inSR: '4326',
    outSR: '4326',
    resultRecordCount: String(maxRecords),
  });
  const url = `${baseUrl}/query?${params.toString()}`;
  const resp = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!resp.ok) return null;
  const data = await resp.json();
  if (data.error) return null;
  return data;
};

// Query an ArcGIS endpoint with a point (returns only containing polygons)
const queryArcGISPoint = async (baseUrl, lat, lng, outFields = '*', maxRecords = 5) => {
  const params = new URLSearchParams({
    geometry: `${lng},${lat}`,
    geometryType: 'esriGeometryPoint',
    spatialRel: 'esriSpatialRelIntersects',
    outFields,
    returnGeometry: 'true',
    f: 'json',
    inSR: '4326',
    outSR: '4326',
    resultRecordCount: String(maxRecords),
  });
  const url = `${baseUrl}/query?${params.toString()}`;
  const resp = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!resp.ok) return null;
  const data = await resp.json();
  if (data.error) return null;
  return data;
};

// Get county FIPS from lat/lng via FCC Census Area API
const getCountyFips = async (lat, lng) => {
  try {
    const url = `${FCC_AREA_URL}?lat=${lat}&lon=${lng}&format=json`;
    const resp = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!resp.ok) return null;
    const data = await resp.json();
    const result = data?.results?.[0];
    if (!result) return null;
    return {
      fips: result.county_fips,
      county: result.county_name,
      state: result.state_code,
    };
  } catch {
    return null;
  }
};

// Crop code lookup
const CROP_CODES = { 1: 'Corn', 2: 'Cotton', 3: 'Rice', 4: 'Sorghum', 5: 'Soybeans', 6: 'Sunflower', 21: 'Barley', 22: 'Durum Wheat', 23: 'Spring Wheat', 24: 'Winter Wheat', 36: 'Alfalfa', 37: 'Other Hay', 41: 'Sugarbeets', 42: 'Dry Beans', 43: 'Potatoes', 44: 'Other Crops', 61: 'Fallow/Idle', 176: 'Grassland/Pasture' };

// Query USDA CSB (multi-year cascade) — fallback source
const queryCSB = async (lat, lng) => {
  for (const { year, crop } of CSB_YEARS) {
    try {
      const baseUrl = `https://pdi.scinet.usda.gov/hosting/rest/services/Hosted/Crop_Sequence_Boundary_${year}/FeatureServer/0`;

      // Try precise point query first — returns only the polygon containing the click
      let data = await queryArcGISPoint(baseUrl, lat, lng, `csbid,csbacres,${crop}`, 5);
      let best = data?.features?.length ? pickBestFeature(data.features, lat, lng) : null;

      // Fall back to small envelope if point misses (click on road/edge)
      if (!best?.geometry?.rings?.[0]) {
        const envelope = buildEnvelope(lat, lng, 0.0008);
        data = await queryArcGIS(baseUrl, envelope, `csbid,csbacres,${crop}`, 10);
        best = data?.features?.length ? pickBestFeature(data.features, lat, lng) : null;
      }

      if (!best?.geometry?.rings?.[0]) continue;

      const cropVal = best.attributes?.[crop];
      return {
        source: 'usda_csb',
        year,
        ring: simplifyRing(best.geometry.rings[0]),
        acres: best.attributes?.csbacres || null,
        crop: CROP_CODES[cropVal] || (cropVal ? `Crop ${cropVal}` : null),
        csbid: best.attributes?.csbid || null,
      };
    } catch { /* try next year */ }
  }

  // Wide fallback (~500m)
  try {
    const wideEnv = buildEnvelope(lat, lng, 0.005);
    const baseUrl = 'https://pdi.scinet.usda.gov/hosting/rest/services/Hosted/Crop_Sequence_Boundary_2022/FeatureServer/0';
    const data = await queryArcGIS(baseUrl, wideEnv, 'csbid,csbacres,r22', 15);
    if (data?.features?.length) {
      const best = pickBestFeature(data.features, lat, lng);
      if (best?.geometry?.rings?.[0]) {
        return {
          source: 'usda_csb',
          year: 2022,
          ring: simplifyRing(best.geometry.rings[0]),
          acres: best.attributes?.csbacres || null,
          crop: CROP_CODES[best.attributes?.r22] || null,
          csbid: best.attributes?.csbid || null,
        };
      }
    }
  } catch { /* no result */ }

  return null;
};

// Query a parcel ArcGIS endpoint (county or state level)
const queryParcelEndpoint = async (url, lat, lng) => {
  try {
    // Point query first — most accurate, returns only parcel containing the click
    let data = await queryArcGISPoint(url, lat, lng, '*', 5);
    let best = data?.features?.length ? pickBestFeature(data.features, lat, lng) : null;

    // Envelope fallback for edge clicks
    if (!best?.geometry?.rings?.[0]) {
      const envelope = buildEnvelope(lat, lng, 0.0003);
      data = await queryArcGIS(url, envelope, '*', 10);
      best = data?.features?.length ? pickBestFeature(data.features, lat, lng) : null;
    }

    if (!best?.geometry?.rings?.[0]) return null;
    return best;
  } catch {
    return null;
  }
};

// Query county parcel endpoint
const queryCountyParcel = async (fips, lat, lng) => {
  const config = COUNTY_PARCELS[fips];
  if (!config) return null;

  const best = await queryParcelEndpoint(config.url, lat, lng);
  if (!best) return null;

  return {
    source: 'county_parcel',
    county: config.county,
    state: config.state,
    ring: best.geometry.rings[0],  // No simplification — parcel data is survey-accurate
    attributes: best.attributes || {},
  };
};

// Query statewide parcel endpoint (keyed by 2-digit state FIPS)
const queryStateParcel = async (fips, lat, lng) => {
  const stateFips = fips?.substring(0, 2);
  const config = STATE_PARCELS[stateFips];
  if (!config) return null;

  const best = await queryParcelEndpoint(config.url, lat, lng);
  if (!best) return null;

  return {
    source: 'state_parcel',
    state: config.state,
    ring: best.geometry.rings[0],
    attributes: best.attributes || {},
  };
};

// ---- Auto-Discovery: find county parcel endpoints via ArcGIS Online search ----
const ARCGIS_SEARCH_URL = 'https://www.arcgis.com/sharing/rest/search';
const DISCOVERY_CACHE_TTL = 90 * 24 * 60 * 60 * 1000; // 90 days
const NEGATIVE_CACHE_TTL = 14 * 24 * 60 * 60 * 1000;  // 14 days for "not found"

// Check if an ArcGIS layer URL returns polygon geometry with rings for a point
const probeEndpoint = async (layerUrl, lat, lng) => {
  try {
    const params = new URLSearchParams({
      geometry: `${lng},${lat}`,
      geometryType: 'esriGeometryPoint',
      spatialRel: 'esriSpatialRelIntersects',
      outFields: 'OBJECTID',
      returnGeometry: 'true',
      f: 'json',
      inSR: '4326',
      outSR: '4326',
      resultRecordCount: '1',
    });
    const resp = await fetch(`${layerUrl}/query?${params}`, { signal: AbortSignal.timeout(8000) });
    if (!resp.ok) return false;
    const data = await resp.json();
    if (data.error) return false;
    return data.features?.length > 0 && data.features[0].geometry?.rings?.length > 0;
  } catch {
    return false;
  }
};

// Resolve the queryable layer URL from a FeatureServer/MapServer base URL
const resolveLayerUrl = async (serviceUrl) => {
  // If URL already ends with /0, /1 etc., use as-is
  if (/\/\d+$/.test(serviceUrl)) return serviceUrl;
  // Otherwise, query the service to find a polygon layer
  try {
    const resp = await fetch(`${serviceUrl}?f=json`, { signal: AbortSignal.timeout(5000) });
    if (!resp.ok) return `${serviceUrl}/0`;
    const info = await resp.json();
    const layers = info.layers || [];
    const polyLayer = layers.find(l =>
      /parcel|lot|cadastr/i.test(l.name) && l.geometryType === 'esriGeometryPolygon'
    ) || layers.find(l => l.geometryType === 'esriGeometryPolygon') || layers[0];
    return `${serviceUrl}/${polyLayer?.id ?? 0}`;
  } catch {
    return `${serviceUrl}/0`;
  }
};

// Search ArcGIS Online for parcel feature services matching a county
const discoverParcelEndpoint = async (countyName, stateName, lat, lng) => {
  if (!countyName) return null;

  // Overall discovery timeout: 25 seconds
  const controller = new AbortController();
  const overallTimeout = setTimeout(() => controller.abort(), 25000);
  let found = null;

  try {
    const cleanCounty = countyName.replace(/\s+County$/i, '').trim();
    const queries = [
      `parcel ${cleanCounty} County ${stateName}`,
      `parcels ${cleanCounty} ${stateName}`,
      `${cleanCounty} County parcels`,
    ];
    const serviceTypes = ['Feature Service', 'Map Service'];

    // Collect all unique candidate URLs from all searches first (fast)
    const seenUrls = new Set();
    const allCandidates = [];

    for (const q of queries) {
      if (found || controller.signal.aborted) break;
      for (const sType of serviceTypes) {
        if (found || controller.signal.aborted) break;
        try {
          const params = new URLSearchParams({
            q, type: sType, f: 'json', num: '10',
            sortField: 'numViews', sortOrder: 'desc',
          });
          const resp = await fetch(`${ARCGIS_SEARCH_URL}?${params}`, { signal: AbortSignal.timeout(5000) });
          if (!resp.ok) continue;
          const data = await resp.json();
          if (!data.results?.length) continue;

          const candidates = data.results
            .filter(r => r.url && /parcel|cadastr|lot|land.record/i.test(r.title || ''))
            .slice(0, 3);

          for (const item of candidates) {
            if (!seenUrls.has(item.url)) {
              seenUrls.add(item.url);
              allCandidates.push(item.url);
            }
          }
        } catch { /* next */ }
      }
    }

    // Probe candidates in parallel batches of 4
    for (let i = 0; i < allCandidates.length && !found && !controller.signal.aborted; i += 4) {
      const batch = allCandidates.slice(i, i + 4);
      const results = await Promise.allSettled(
        batch.map(async (serviceUrl) => {
          const layerUrl = await resolveLayerUrl(serviceUrl);
          const works = await probeEndpoint(layerUrl, lat, lng);
          return works ? layerUrl : null;
        })
      );
      for (const r of results) {
        if (r.status === 'fulfilled' && r.value) {
          found = r.value;
          break;
        }
      }
    }
  } catch { /* overall timeout or error */ }

  clearTimeout(overallTimeout);
  return found;
};

// Get cached endpoint from Firestore, or discover and cache a new one
const getOrDiscoverEndpoint = async (fips, countyName, stateName, lat, lng) => {
  const db = admin.firestore();
  const docRef = db.collection('parcelEndpoints').doc(fips);

  // Check Firestore cache first
  try {
    const doc = await docRef.get();
    if (doc.exists) {
      const cached = doc.data();
      const age = Date.now() - (cached.timestamp || 0);
      // Return cached URL if still valid
      if (cached.url && age < DISCOVERY_CACHE_TTL) {
        return cached.url;
      }
      // Return null (negative cache) if recently checked and nothing found
      if (!cached.url && age < NEGATIVE_CACHE_TTL) {
        return null;
      }
    }
  } catch { /* cache miss, proceed to discovery */ }

  // Discover endpoint
  const url = await discoverParcelEndpoint(countyName, stateName, lat, lng);

  // Cache result (positive or negative)
  try {
    await docRef.set({
      url: url || null,
      county: countyName,
      state: stateName,
      timestamp: Date.now(),
      discovered: !!url,
    });
  } catch { /* caching failure is non-fatal */ }

  return url;
};

// Query auto-discovered parcel endpoint
const queryDiscoveredParcel = async (fips, countyName, stateName, lat, lng) => {
  const url = await getOrDiscoverEndpoint(fips, countyName, stateName, lat, lng);
  if (!url) return null;

  const best = await queryParcelEndpoint(url, lat, lng);
  if (!best) return null;

  return {
    source: 'discovered_parcel',
    county: countyName,
    state: stateName,
    ring: best.geometry.rings[0],
    attributes: best.attributes || {},
  };
};

exports.getFieldBoundary = onRequest({ timeoutSeconds: 120 }, async (req, res) => {
  // CORS
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).send('');

  const lat = parseFloat(req.query.lat || req.body?.lat);
  const lng = parseFloat(req.query.lng || req.body?.lng);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return res.status(400).json({ error: 'lat and lng are required numeric parameters.' });
  }

  // Clamp to valid ranges
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return res.status(400).json({ error: 'lat/lng out of range.' });
  }

  try {
    // Step 1: Identify county via FCC API
    const county = await getCountyFips(lat, lng);
    const fips = county?.fips || null;

    // Step 2: Try county parcel data, then statewide parcel, then auto-discover, then CSB
    let result = null;
    if (fips) {
      result = await queryCountyParcel(fips, lat, lng);
      if (!result) {
        result = await queryStateParcel(fips, lat, lng);
      }
      if (!result) {
        result = await queryDiscoveredParcel(fips, county?.county, county?.state, lat, lng);
      }
    }

    // Step 3: Fall back to USDA CSB
    if (!result) {
      result = await queryCSB(lat, lng);
    }

    if (!result) {
      return res.status(404).json({
        found: false,
        county: county?.county || null,
        state: county?.state || null,
        fips,
      });
    }

    return res.status(200).json({
      found: true,
      ...result,
      fips,
      countyName: county?.county || result.county || null,
      stateName: county?.state || result.state || null,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Internal server error.' });
  }
});
