import User from '../models/User.js';
import bcrypt from 'bcryptjs';
import sendTokenResponse from '../utils/sendTokenResponse.js';


// Developer credentials - Change these to your desired credentials
const DEVELOPER_USERNAME = 'sumit26';  // Change this
const DEVELOPER_EMAIL = 'sumitupadhyay0107@gmail.com';  // Change this


// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
export const register = async (req, res, next) => {
  try {
    const { name, email, username, password } = req.body;

    // Check if user exists
    const userExists = await User.findOne({ $or: [{ email }, { username }] });
    if (userExists) {
      return res.status(400).json({ 
        success: false, 
        message: 'User with this email or username already exists' 
      });
    }

    const userCount = await User.countDocuments();
    const isFirstUser = userCount === 0;
    const isDeveloper = username === DEVELOPER_USERNAME || email === DEVELOPER_EMAIL;

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Generate avatar
    const avatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`;

    // Create user
    const user = await User.create({
      name,
      email,
      username,
      password: hashedPassword,
      avatar,
      verified: isFirstUser || isDeveloper,  // Auto-verify first user
      isAdmin: isFirstUser || isDeveloper
    });

    if (isFirstUser) {
      console.log('🎉 First user registered - Auto-verified as admin and developer!');
    } else if (isDeveloper) {
      console.log('👨‍💻 Developer account registered - Auto-verified as admin!');
    }

    sendTokenResponse(user, 201, res);
  } catch (error) {
    next(error);
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({ 
        success: false, 
        message: 'Please provide email and password' 
      });
    }

    // Check for user (include password for comparison)
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid credentials' 
      });
    }

    // Check if password matches
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid credentials' 
      });
    }

    // Update user status
    user.isActive = true;
    user.lastSeen = Date.now();
    await user.save();

    sendTokenResponse(user, 200, res);
  } catch (error) {
    next(error);
  }
};

// @desc    Logout user
// @route   POST /api/auth/logout
// @access  Private
export const logout = async (req, res, next) => {
  try {
    // Update user status
    await User.findByIdAndUpdate(req.user._id, {
      isActive: false,
      lastSeen: Date.now()
    });

    res.cookie('token', 'none', {
      expires: new Date(Date.now() + 10 * 1000),
      httpOnly: true
    });

    res.status(200).json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get current user
// @route   GET /api/auth/me
// @access  Private
export const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id)
      .populate('followers', 'name username avatar verified')
      .populate('following', 'name username avatar verified');

    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    next(error);
  }
};