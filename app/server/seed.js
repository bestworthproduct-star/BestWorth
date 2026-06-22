const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');

dotenv.config();

const User = require('./models/User');

const Product = require('./models/Product');
const Inquiry = require('./models/Inquiry');
const Content = require('./models/Content');

const seed = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/bestworth');
    console.log('Connected to MongoDB');
    
    // Admin
    const adminExists = await User.findOne({ username: 'admin' });
    if (!adminExists) {
      const hashedPassword = await bcrypt.hash('admin123', 10);
      await User.create({ username: 'admin', password: hashedPassword });
      console.log('Admin user created');
    }
    
    // Products
    const productCount = await Product.countDocuments();
    if (productCount === 0) {
      await Product.create([
        { name: 'Roofing Nails', category: 'nails', description: 'Galvanized nails for corrugated roofing', image: '/assets/product-roofing.jpg', featured: true },
        { name: 'Wire Nails', category: 'nails', description: 'General purpose wire nails', image: '/assets/product-wire.jpg' },
        { name: 'Wood Screws', category: 'screws', description: 'Precision threaded wood screws', image: '/assets/product-wood-screw.jpg' }
      ]);
      console.log('Sample products seeded');
    }

    // Inquiries
    const inquiryCount = await Inquiry.countDocuments();
    if (inquiryCount === 0) {
      await Inquiry.create([
        { name: 'John Doe', email: 'john@example.com', company: 'JD Construction', message: 'Interested in bulk orders of roofing nails.', status: 'new' }
      ]);
      console.log('Sample inquiry seeded');
    }

    // Site Content
    await Content.deleteMany();
    await Content.create([
      {
        key: 'hero',
        data: {
          title: 'ENGINEERED FOR THE INDUSTRIAL FRONTIER',
          subtitle: 'Precision-crafted nails, screws, and fasteners designed for durability in the world\'s most demanding environments.',
          buttonText: 'EXPLORE CATALOG',
          videoUrls: ['/assets/Hero-Video.mp4'],
          establishmentDate: 'EST. 1987',
          idleHideDelaySeconds: 25
        }
      },
      {
        key: 'about',
        data: {
          title: 'A LEGACY OF STRENGTH',
          description: [
            'Bestworth Products Limited has been at the forefront of the construction materials industry since 1987. We specialize in the manufacturing and distribution of premium-grade fasteners that serve as the backbone of modern infrastructure.',
            'Our commitment to quality ensures that every product leaving our facility meets rigorous international standards, providing reliability where it matters most.'
          ],
          imageUrl: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?q=80&w=2070'
        }
      },
      {
        key: 'values',
        data: [
          { title: 'PRECISION', description: 'Micron-perfect engineering in every batch.', icon: 'Target' },
          { title: 'DURABILITY', description: 'Materials tested against the harshest elements.', icon: 'Shield' },
          { title: 'INTEGRITY', description: 'Transperent sourcing and ethical production.', icon: 'Briefcase' }
        ]
      },
      {
        key: 'contact',
        data: {
          address: '12 Industrial Way, Lagos, Nigeria',
          phone: '+234 800 BESTWORTH',
          email: 'sales@bestworth.com',
          mapUrl: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3963.952912260219!2d3.3758232!3d6.5212408!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x103b8b2ae68280c1%3A0xdc9e87a397c7d60e!2sLagos!5e0!3m2!1sen!2sng!4v1715600000000!5m2!1sen!2sng'
        }
      },
      {
        key: 'footer',
        data: {
          copyright: '© 2024 Bestworth Products Limited. All rights reserved.',
          registrationNumber: 'RC: 1191234',
          socials: {
            facebook: 'https://facebook.com/bestworth',
            linkedin: 'https://linkedin.com/company/bestworth',
            instagram: 'https://instagram.com/bestworth'
          }
        }
      }
    ]);
    console.log('Site content seeded');
    
    process.exit();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

seed();
