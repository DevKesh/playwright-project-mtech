function createUniqueEmail(baseEmail) {
  const [, domainPart] = baseEmail.split('@');
  const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  return `pwuser${suffix}@${domainPart}`;
}

function createUniqueUser(baseRegisterData) {
  const uniquePhone = `9${String(100000000 + Math.floor(Math.random() * 899999999))}`;

  return {
    ...baseRegisterData,
    email: createUniqueEmail(baseRegisterData.email),
    phone: uniquePhone,
  };
}

module.exports = {
  createUniqueEmail,
  createUniqueUser,
};
