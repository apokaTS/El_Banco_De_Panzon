const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    balance: { type: Number, default: 0 },
    cardStatus: { type: String, default: "active" },
    transactions: {
      type: [
        {
          type: { type: String },
          amount: Number,
          date: Date,
        },
      ],
      default: [],
    },
  },
  { timestamps: true }
);

// Hash password before saving (if modified)
userSchema.pre("save", function (next) {
  const user = this;
  if (!user.isModified("password")) return next();
  try {
    const salt = bcrypt.genSaltSync(10);
    user.password = bcrypt.hashSync(user.password, salt);
    return next();
  } catch (err) {
    return next(err);
  }
});

// Instance method to compare password
userSchema.methods.comparePassword = function (candidatePassword) {
  return bcrypt.compareSync(candidatePassword, this.password);
};

module.exports = mongoose.model("User", userSchema);
