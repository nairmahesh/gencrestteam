import 'dotenv/config';
import mongoose from 'mongoose';
import config from '../config';
import { User } from '../models/user.model';
import { logger } from '../utils/logger';

const createAdminUser = async () => {
  try {
    // 1. Connect to the database
    logger.info('Connecting to MongoDB...');
    await mongoose.connect(config.mongoURI);
    logger.info('🍃 MongoDB connected.');

    // 2. Check if admin user already exists
    const adminEmployeeId = 'sfaadmin';
    const existingAdmin = await User.findOne({ employeeId: adminEmployeeId });

    if (existingAdmin) {
      logger.warn(`Admin user with employeeId '${adminEmployeeId}' already exists.`);
      return;
    }

    // 3. Create the admin user
    logger.info(`Creating default admin user '${adminEmployeeId}'...`);
    const adminData = {
      firstName: 'SFA',
      lastName: 'Admin',
      employeeId: adminEmployeeId,
      email: 'admin@sfa.com', // Ensure this email is unique
      phone: '0000000000',     // Ensure this phone is unique
      role: 'admin',
      password: 'sfaadmin',
      isPasswordSet: true, // IMPORTANT: Set to true so admin isn't forced to change password
      isActive: true,
    };

    const admin = new User(adminData);
    await admin.save(); // The 'pre-save' hook will hash the password

    logger.info('✅ Default admin user created successfully.');

  } catch (error) {
    logger.error({ err: error }, 'Error creating default admin user');
  } finally {
    // 4. Disconnect from the database
    await mongoose.disconnect();
    logger.info('MongoDB disconnected.');
  }
};

// Run the script
createAdminUser();