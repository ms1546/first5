const required = (key: string): string => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
};

export const authConfig = {
  region: required("COGNITO_REGION"),
  userPoolId: required("COGNITO_USER_POOL_ID"),
  clientId: required("COGNITO_CLIENT_ID"),
  domain: required("COGNITO_DOMAIN"),
  redirectUri: required("COGNITO_REDIRECT_URI"),
  logoutRedirectUri: required("COGNITO_LOGOUT_REDIRECT_URI"),
  scopes: (process.env.COGNITO_SCOPES ?? "openid email profile").split(/\s+/),
};

export const authPaths = {
  authorize: `https://${authConfig.domain}/oauth2/authorize`,
  token: `https://${authConfig.domain}/oauth2/token`,
  logout: `https://${authConfig.domain}/logout`,
  issuer: `https://cognito-idp.${authConfig.region}.amazonaws.com/${authConfig.userPoolId}`,
  jwks: `https://cognito-idp.${authConfig.region}.amazonaws.com/${authConfig.userPoolId}/.well-known/jwks.json`,
};
