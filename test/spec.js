var should = require('should');

var liferay;
var config;

try {
  liferay = require('liferay-connector');
  config = require('config');
}
catch (e) {
  liferay = require('..');
  config = require('./config');
}

var Promise = liferay.Promise;

var TIMEOUT = 10e3;

var PORTAL_URL = config.PORTAL_URL;
var AUTH = config.AUTH;
var WRONG_AUTH = config.WRONG_AUTH;

var connector;
var connection;
var userGroup;

describe("The camelcase#normalize util", function () {
  var known = {
    // Known to be preserved
    "somethingUrl": "somethingUrl",
    // Known to be mangled
    "classPK": "classPk",
    "feedURL": "feedUrl",
    "entryURL": "entryUrl",
    "homeURL": "homeUrl",
    "smallImageURL": "smallImageUrl",
    "newClassPK": "newClassPk",
    "contentURL": "contentUrl",
    "friendlyURL": "friendlyUrl",
    "articleURL": "articleUrl",
    "displayDateGT": "displayDateGt",
    "displayDateLT": "displayDateLt",
    "friendlyURLMap": "friendlyUrlMap",
    "inUseSSL": "inUseSsl",
    "outUseSSL": "outUseSsl",
    "permissionClassPK": "permissionClassPk",
    "inputStreamOVPs": "inputStreamOvPs",
    "pageURL": "pageUrl",
    "downloadPageURL": "downloadPageUrl",
    "directDownloadURL": "directDownloadUrl",
    "testDirectDownloadURL": "testDirectDownloadUrl",
    "mediumImageURL": "mediumImageUrl",
    "largeImageURL": "largeImageUrl",
    "overrideClassPK": "overrideClassPk",
    "attachmentURLPrefix": "attachmentUrlPrefix"
  };

  it("should mangle correctly the known affected parameter names", function () {
    Object.keys(known).forEach(function (from) {
      var to = known[ from ];
      liferay.camelcase.normalize(from).should.eql(to);
    });
  });

  it("should be idempotent", function () {
    Object.keys(known).forEach(function (from) {
      var to = known[ from ];
      liferay.camelcase.normalize(to).should.eql(to);
    });
  });
});

describe("The camelcase.normalizeParameter util", function () {
  it("should preserve inner parameters", function () {
    liferay.camelcase.normalizeParameter("fullURL.fullURL").should.eql("fullUrl.fullURL");
  });
});

describe("The Connector#mangleCamelCase util", function () {
  it("should preserve nested service calls", function () {
    liferay.base.prototype.mangleCamelCase({
      "$user = /user/get-user-by-id": {
        "fullURL": 123,
        "userId": 123,
        "$contact = /contact/get-contact-by-id": {
          "fullURL": 123,
          "@contactId" : "$user.contactId"
        }
      }
    }).should.eql({
      "$user = /user/get-user-by-id": {
        "fullUrl": 123,
        "userId": 123,
        "$contact = /contact/get-contact-by-id": {
          "fullUrl": 123,
          "@contactId" : "$user.contactId"
        }
      }
    });
  });

  it("should preserve inner parameters", function () {
    liferay.base.prototype.mangleCamelCase({
      "/some/path": {
        "+fullURL": "java.util.Something",
        "fullURL.fullURL": 123
      }
    }).should.eql({
      "/some/path": {
        "+fullUrl": "java.util.Something",
        "fullUrl.fullURL": 123
      }
    });
  });
});

describe("The global connector", function () {

  this.timeout(TIMEOUT);

  it("should be able to indentify a Liferay (≥6.1)", function () {
    return liferay.identify(PORTAL_URL, AUTH).then(function (conn) {
      connector = conn;
    });
  });
});

describe("The given connector", function () {

  this.timeout(TIMEOUT);

  it("should give a valid connector", function () {
    connector.should.have.a.property('authenticate');
  });

  it("should authenticate correctly", function () {
    return connector.authenticate(PORTAL_URL, AUTH).then(function (conn) {
      connection = conn;
    });
  });

  it("should not authenticate with wrong credentials", function () {
    return connector.authenticate(PORTAL_URL, WRONG_AUTH).then(function () {
      throw new Error("The portal authenticated with wrong credentials!");
    })
    .catch(liferay.errors.Unauthorized, function (err) {
      return null;
    });
  });

  testConnectionQuality(1);
});

describe("Automatic authentication", function () {

  this.timeout(TIMEOUT);

  it("should authenticate without an identification", function () {
    return liferay.authenticate(PORTAL_URL, AUTH).then(function (conn) {
      connection = conn;
    });
  });

  testConnectionQuality(2);
});

function testConnectionQuality(count) {
  it("should have a few interesting properties (" + count + ")", function () {
    connection.should.have.a.property('user');
    connection.should.have.a.property('companyId');
    connection.companyId.should.be.greaterThan(0);
    connection.user.should.have.a.property('userId');
  });

  it("should have a few interesting methods (" + count + ")", function () {
    connection.should.have.a.property('invoke');
    connection.should.have.a.property('raw');

    connection.invoke.should.be.a.Function;
    connection.raw.should.be.a.Function;
  });
}

// See: https://www.liferay.com/web/james.falkner/blog/-/blogs/diy-liferay-events-hacks-part-1
// Test: https://www.liferay.com/api/jsonws/skinny-web.skinny/get-skinny-ddl-records?ddlRecordSetId=35246557

xdescribe("Guest connection", function () {
  xit("should work with an uknown Liferay version");

  xit("should work with a known Liferay version", function () {
    this.timeout(4e3);

    return liferay.v61.guest('https://www.liferay.com').then(function (session) {
      return session.invoke({
        "/skinny-web.skinny/get-skinny-ddl-records": {
          // Hard coded one...
          ddlRecordSetId: 36416693
        }
      })
      .then(function (results) {
        results.should.an.Array;
      });
    });
  });
});

describe("Error assimilation", function () {
  it("should not get an MBMessage by a random id", function () {
    return connection.invoke({
      "/mbmessage/get-message": {
        messageId: 99999999
      }
    })
    .then(function (message) {
      throw new Error("Got a message with random id");
    })
    .catch(liferay.errors.NotFound, function (err) {
      return null;
    });
  });

  it("should understand wrong services", function () {
    return connection.invoke({
      "/i-do-not-exists/neither-i": {}
    })
    .then(function () {
      throw new Error("Resolved a non-existent service");
    })
    .catch(liferay.errors.BadRequest, function (err) {
      return null;
    });
  });

  it("should understand wrong contexts", function () {
    return connection.invoke({
      "/neverland-portlet.i-do-not-exists/neither-i": {}
    })
    .then(function () {
      throw new Error("Resolved a non-existent context");
    })
    .catch(liferay.errors.BadRequest, function (err) {
      return null;
    });
  });
});

describe("Document Library services", function () {
  it("should be able to read boolean (false) values", function () {
    return connection.invoke({
      "/dlfolder/is-folder-locked": {
        folderId: -1 // I want to be sure it returns `false`
      }
    })
    .then(function (result) {
      result.should.be.a.Boolean;
    });
  });
});

describe("Bookmarks services", function () {
  it("(with the user group)", function () {
    var candidates = connection.sites.filter(function (group) {
      return group.friendlyURL === '/' + connection.user.screenName;
    });

    candidates.should.have.length(1);

    userGroup = candidates[0];

    userGroup.should.have.a.property('groupId');
    userGroup.should.have.a.property('companyId');
  });

  var entry;

  it("should be able to create (valid) entries", function () {
    var now = new Date();
    return connection.invoke({
      "/bookmarksentry/add-entry": {
        groupId: userGroup.groupId,
        folderId: 0,
        name: 'name-' + Math.random(),
        url: 'http://www.site.com',
        description: 'description-' + Math.random(),
        serviceContext: {
          companyId: userGroup.companyId,
          scopeGroupId: userGroup.groupId,
          addGuestPermissions: true,
          addGroupPermissions: true
        }
      }
    })
    .then(function (result) {
      entry = result;

      entry.should.have.a.property('entryId');
      entry.should.have.a.property('name');
      entry.should.have.a.property('url');
      entry.should.have.a.property('description');

      entry.entryId.should.be.a.Number;
    });
  });

  it("should get that same entry", function () {
    return connection.invoke({
      "/bookmarksentry/get-entry": {
        entryId: entry.entryId
      }
    })
    .then(function (result) {
      result.should.eql(entry);
    });
  });

  it("should return a number of entries", function () {
    return connection.invoke({
      "/bookmarksentry/get-entries-count": {
        groupId: userGroup.groupId,
        folderId: 0
      }
    })
    .then(function (result) {
      result.should.be.greaterThan(0);
    });
  });

  it("should delete a fresh entry", function () {
    return connection.invoke({
      "/bookmarksentry/delete-entry": {
        entryId: entry.entryId
      }
    })
    .then(function () {
      return connection.invoke({
        "/bookmarksentry/get-entry": {
          entryId: entry.entryId
        }
      })
      .then(function (entry) {
        throw new Error("Didn't deleted the entry with id: " + entry.entryId);
      })
      .catch(liferay.errors.NotFound, function () {
        return null;
      });
    });
  });
});

if (config.TEST_COMPANION_PLUGIN) describe("Smoke tests (companion)", function () {
  it("should reach the companion (1/2)", function () {
    return connection.invoke({
      "/connector-companion-portlet/tests/smoke-test": {
        input: true
      }
    })
    .then(function (output) {
      output.should.be.false;
    });
  });

  it("should reach the companion (2/2)", function () {
    return connection.invoke({
      "/connector-companion-portlet/tests/smoke-test": {
        input: false
      }
    })
    .then(function (output) {
      output.should.be.true;
    });
  });
});

if (config.TEST_COMPANION_PLUGIN) describe("Return types (companion)", function () {
  it("should support JSONObject", function () {
    return connection.invoke({
      "/connector-companion-portlet/tests/json-object-test": {
        property: 'answer',
        value: '42'
      }
    })
    .then(function (jsonObject) {
      jsonObject.should.have.a.property("answer");
      jsonObject.answer.should.be.eql("42");
    });
  });

  it("should support User", function () {
    return connection.invoke({
      "/connector-companion-portlet/tests/current-user": {}
    })
    .then(function (user) {
      user.should.have.a.property('userId');
    })
  });
});

if (config.TEST_COMPANION_PLUGIN) describe("Service Context (companion)", function () {
  it("should support explicit ServiceContext parameters", function () {
    return connection.invoke({
      "/connector-companion-portlet/tests/service-context-smoke-test": {
        currentUrl: 'nonsense',
        scopeGroupId: userGroup.groupId,
        '+serviceContext': 'com.liferay.portal.service.ServiceContext',
        'serviceContext.scopeGroupId': userGroup.groupId,
        'serviceContext.currentURL': 'nonsense'
      }
    })
    .then(function (ok) {
      ok.should.be.true;
    });
  });

  it("should support implicit (with type) ServiceContext parameters", function () {
    return connection.invoke({
      "/connector-companion-portlet/tests/service-context-smoke-test": {
        currentUrl: 'nonsense',
        scopeGroupId: userGroup.groupId,
        'serviceContext:com.liferay.portal.service.ServiceContext': {
          scopeGroupId: userGroup.groupId,
          currentURL: 'nonsense'
        }
      }
    })
    .then(function (ok) {
      ok.should.be.true;
    });
  });

  it("should support implicit ServiceContext parameters", function () {
    return connection.invoke({
      "/connector-companion-portlet/tests/service-context-smoke-test": {
        currentUrl: 'nonsense',
        scopeGroupId: userGroup.groupId,
        serviceContext: {
          scopeGroupId: userGroup.groupId,
          currentURL: 'nonsense'
        }
      }
    })
    .then(function (ok) {
      ok.should.be.true;
    });
  });
});

if (config.TEST_COMPANION_PLUGIN) describe("Parameter names (companion)", function () {
  it("should support manually mangled parameters", function () {
    return connection.invoke({
      "/connector-companion-portlet/tests/parameter-names-test": {
        somethingUrl: 'abc',
        somethingOvPs: 'def'
      }
    })
    .then(function (ok) {
      ok.should.be.true;
    });
  });

  it("should support not-mangled parameters", function () {
    return connection.invoke({
      "/connector-companion-portlet/tests/parameter-names-test": {
        somethingURL: 'abc',
        somethingOVPs: 'def'
      }
    })
    .then(function (ok) {
      ok.should.be.true;
    });
  });
});
