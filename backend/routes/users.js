var express = require("express");
var router = express.Router();
const bcrypt = require("bcrypt");
const config = require("config");
const jwt = require("jsonwebtoken");
const { body, validationResult } = require("express-validator");
const User = require("../models/user");
const Followers = require("../models/followers");
const Following = require("../models/following");

const upload = require("../middleware/imageUpload");

const auth = require("../middleware/auth");
const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;

router.get("/profile/:id", async (req, res) => {
  try {
    var user = await User.findById(req.params.id, {
      profileAudio: 1,
      profilePicture: 1,
      userName: 1,
      email: 1,
    });
    res.json(user);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/followers/:id", async (req, res) => {
  try {
    var followers = await Followers.find(
      { userId: req.params.id },
      {
        followers: 1,
      }
    );
    res.json(followers);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/following/:id", async (req, res) => {
  try {
    var following = await Following.find(
      { userId: req.params.id },
      {
        following: 1,
      }
    );
    res.json(following);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/upload-image", upload.single("image"), async function (req, res) {
  res.json(req.file.location);
});

router.post(
  "/signup",
  [
    body("email", "Invalid input").trim().escape().isLength({
      min: 1,
    }),
  ],
  async (req, res, next) => {
    // Extract the validation errors from a request.
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      // There are errors. Render form again with sanitized values/errors messages.
      // Error messages can be returned in an array using `errors.array()`.
      console.log("Found validation errors");
      return res.status(422).json({
        errors: errors.array(),
      });
    } else {
      // Data from form is valid. Store in database
      const form = req.body;

      try {
        //find an existing user
        var email = req.body.email.toLowerCase();
        let user = await User.findOne({ email: email });
        if (user) return res.status(400).send("User already registered.");

        const newUser = new User({
          userName: form.userName,
          email: email,
          password: form.password,
        });
        newUser.password = await bcrypt.hash(newUser.password, 10);

        await newUser.save();
        const token = await newUser.generateAuthToken();

        res.send({
          token: token,
        });
      } catch (err) {
        console.error(err.message);
        res.status(500).json({ message: "Server error" });
      }
    }
  }
);
router.post(
  "/login",
  [
    body("email", "Invalid input").trim().escape().isLength({
      min: 1,
    }),
  ],
  async (req, res, next) => {
    // Extract the validation errors from a request.
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      // There are errors. Render form again with sanitized values/errors messages.
      // Error messages can be returned in an array using `errors.array()`.
      console.log("Found validation errors");
      return res.status(422).json({
        errors: errors.array(),
      });
    } else {
      // Data from form is valid. Store in database
      const form = req.body;

      try {
        var email = req.body.email.toLowerCase();
        const user = await User.findOne({ email: email });

        // Check if user exist
        if (user) {
          match = await user.comparePassword(user, req.body.password);

          // Check if password matches
          if (match) {
            const token = user.generateAuthToken();
            res.send({
              token: token,
            });
          } else {
            res.status(401).send("email and password doesn't match");
          }
        } else {
          res.status(400).send("User doesn't exist");
        }
      } catch (err) {
        console.error(err.message);
        res.status(500).json({ message: "Server error" });
      }
    }
  }
);

router.post("/follow", async (req, res, next) => {
  console.log(req.body);
  const form = req.body;

  var userToFollowObj = await User.findById(form.userToFollow, {
    profileAudio: 1,
    profilePicture: 1,
    userName: 1,
  });
  var myUserObj = await User.findById(form.userId, {
    profileAudio: 1,
    profilePicture: 1,
    userName: 1,
  });

  try {
    // Set so that logged in user follows the selected user
    const following = await Following.findOneAndUpdate(
      {
        userId: form.userId,
      },
      { $push: { following: userToFollowObj } }
    );
    if (!following) {
      const following = new Following({
        userId: form.userId,
        following: [userToFollowObj],
      });
      await following.save();
    }

    // Update my following count
    await User.findOneAndUpdate(
      { _id: form.userId },
      { $inc: { followingCount: 1 } }
    );

    // Update the other users follower count
    await User.findOneAndUpdate(
      { _id: form.userToFollow },
      { $inc: { followerCount: 1 } }
    );

    // Set so that the selected user is followed by the logged in user
    const followers = await Followers.findOneAndUpdate(
      {
        userId: form.userToFollow,
      },
      { $push: { followers: myUserObj } }
    );
    if (!followers) {
      const followers = new Followers({
        userId: form.userToFollow,
        followers: [myUserObj],
      });
      await followers.save();
    }
    res.status(200).send("user followed");
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/unfollow", async (req, res, next) => {
  console.log(req.body);
  const form = req.body;

  try {
    // Set so that logged in user unfollows the selected user
    await Following.updateOne(
      {
        userId: form.userId,
      },
      { $pull: { following: { _id: form.userToUnfollow } } }
    );

    // Set so that the selected user is no longer followed by the logged in user
    await Followers.updateOne(
      {
        userId: form.userToUnfollow,
      },
      { $pull: { followers: { _id: form.userId } } }
    );
    res.status(200).send("user unfollowed");
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
