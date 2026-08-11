const jwt = require('jsonwebtoken');

const ACCESS_TOKEN_TTL = '1h';
const REFRESH_TOKEN_TTL = '7d';
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const signAccessToken = (user) =>
    jwt.sign({ sub: user.id, username: user.username }, process.env.JWT_ACCESS_SECRET, {
        expiresIn: ACCESS_TOKEN_TTL,
    });

const signRefreshToken = (user) =>
    jwt.sign({ sub: user.id }, process.env.JWT_REFRESH_SECRET, {
        expiresIn: REFRESH_TOKEN_TTL,
    });

const verifyAccessToken = (token) => jwt.verify(token, process.env.JWT_ACCESS_SECRET);

const verifyRefreshToken = (token) => jwt.verify(token, process.env.JWT_REFRESH_SECRET);

module.exports = {
    signAccessToken,
    signRefreshToken,
    verifyAccessToken,
    verifyRefreshToken,
    REFRESH_TOKEN_TTL_MS,
};
