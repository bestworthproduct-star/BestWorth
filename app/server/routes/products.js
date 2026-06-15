const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const auth = require('../middleware/auth');
const {
  hydrateMediaFieldsForResponse,
  normalizeMediaFieldsForStorage
} = require('../utils/public-url');

// Public: Get all products
router.get('/', async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });
    res.json(products.map((product) => hydrateMediaFieldsForResponse(req, product.toObject())));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Admin: Add product
router.post('/', auth, async (req, res) => {
  const product = new Product(normalizeMediaFieldsForStorage(req.body));
  try {
    const newProduct = await product.save();
    const payload = hydrateMediaFieldsForResponse(req, newProduct.toObject());
    req.app.get('io').emit('product_change', { action: 'create', data: payload });
    res.status(201).json(payload);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Admin: Update product
router.put('/:id', auth, async (req, res) => {
  try {
    const updatedProduct = await Product.findByIdAndUpdate(
      req.params.id,
      normalizeMediaFieldsForStorage(req.body),
      { new: true }
    );
    const payload = hydrateMediaFieldsForResponse(req, updatedProduct.toObject());
    req.app.get('io').emit('product_change', { action: 'update', data: payload });
    res.json(payload);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Admin: Delete product
router.delete('/:id', auth, async (req, res) => {
  try {
    await Product.findByIdAndDelete(req.params.id);
    req.app.get('io').emit('product_change', { action: 'delete', id: req.params.id });
    res.json({ message: 'Product deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
