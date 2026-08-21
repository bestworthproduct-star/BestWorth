const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const auth = require('../middleware/auth');
const { requirePermission } = require('../middleware/authorize');
const {
  hydrateMediaFieldsForResponse,
  normalizeMediaFieldsForStorage
} = require('../utils/public-url');
const { stringField, safeHttpUrl, objectId } = require('../utils/validation');

function productPayload(body = {}) {
  return normalizeMediaFieldsForStorage({
    name: stringField(body.name, { name: 'Product name', required: true, max: 180 }),
    category: stringField(body.category, { name: 'Category', required: true, max: 100 }),
    description: stringField(body.description, { name: 'Description', required: true, max: 3000 }),
    image: safeHttpUrl(body.image, { name: 'Product image', allowRelative: true }),
    featured: body.featured === true
  });
}

// Public: Get all products
router.get('/', async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });
    res.json(products.map((product) => hydrateMediaFieldsForResponse(req, product.toObject())));
  } catch (err) {
    res.status(500).json({ message: 'Products could not be loaded.' });
  }
});

// Admin: Add product
router.post('/', auth, requirePermission('catalog', 'manage'), async (req, res) => {
  try {
    const product = new Product(productPayload(req.body));
    const newProduct = await product.save();
    const payload = hydrateMediaFieldsForResponse(req, newProduct.toObject());
    req.app.get('io').emit('product_change', { action: 'create', data: payload });
    res.status(201).json(payload);
  } catch (err) {
    res.status(400).json({ message: err.message || 'Invalid product data.' });
  }
});

// Admin: Update product
router.put('/:id', auth, requirePermission('catalog', 'manage'), async (req, res) => {
  try {
    objectId(req.params.id, 'Product ID');
    const updatedProduct = await Product.findByIdAndUpdate(
      req.params.id,
      productPayload(req.body),
      { returnDocument: 'after', runValidators: true }
    );
    if (!updatedProduct) return res.status(404).json({ message: 'Product not found.' });
    const payload = hydrateMediaFieldsForResponse(req, updatedProduct.toObject());
    req.app.get('io').emit('product_change', { action: 'update', data: payload });
    res.json(payload);
  } catch (err) {
    res.status(400).json({ message: 'Product could not be updated.' });
  }
});

// Admin: Delete product
router.delete('/:id', auth, requirePermission('catalog', 'manage'), async (req, res) => {
  try {
    objectId(req.params.id, 'Product ID');
    await Product.findByIdAndDelete(req.params.id);
    req.app.get('io').emit('product_change', { action: 'delete', id: req.params.id });
    res.json({ message: 'Product deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Product could not be deleted.' });
  }
});

module.exports = router;
