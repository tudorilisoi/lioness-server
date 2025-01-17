const {
  FETCH_INFO: { SORT_ASC, SORT_DESC, ITEMS_PER_PAGE },
  ROLES: { ADMIN_ROLE, CLIENT_ROLE, MANAGER_ROLE, CONTRACTOR_ROLE },
  usersDefaultOptions
} = require("../src/config");

// require('es6-promise').polyfill();
// require('isomorphic-fetch');

const queryString = require("query-string");
const passport = require('passport');
const request = require('supertest')
const { setKnexInstance } = require('../src/auth/strategies')
const jwtAuth = passport.authenticate('jwt', { session: false });
// const knex = require("knex");
const app = require("../src/app");
const { makeTestKnex, populateDB, fixturesData } = require("./helpers");
const { clearData } = require("../seeds/seedData");

const { TEST_DB_URL } = require("../src/config");
const { API_TOKEN } = process.env;
const UsersService = require("../src/users/users-service");
const { expect, assert } = require("chai");

let db;
let authToken

const doLogin = () => supertest(app)
  .post(
    '/api/auth/login')

  // method: 'POST',
  .send({
    email: 'Mervin.Graham@hotmail.com',
    password: 'GAfJ8cFYg2J1SdS',
  })
  .set('Accept', 'application/json')
  .expect('Content-Type', /json/)
  .then(r => {
    authToken = r.body.authToken
  })
describe("Projects Endpoints", function () {
 
  before(async () => {
    db = makeTestKnex();
    app.set("db", db);
    setKnexInstance(db)
    await doLogin()
  })
  after(async () => {
    await db.destroy();
    console.log("server closed");
  });

  describe(`GET /api/users`, async () => {
    context(`Given no users`, () => {
      it(`responds with 200 and an empty list`, async () => {
        await clearData(db);
        return supertest(app)
          .get("/api/users")
          .set({ Authorization: `Bearer ${authToken}` })
          .expect(200, {
            data: [],
            numPages: 0,
            totalItemCount: 0,
            params: usersDefaultOptions
          });
      });
    });
    context("Given there are users in the database", async () => {
      it("GET /api/users responds with 200 and sorts by nameSort ASC", async () => {
        await populateDB(db);

        let opts = { ...usersDefaultOptions, userNameSort: SORT_ASC };
        const qs = queryString.stringify(opts);
        await UsersService.getUsers(db, opts);
        return supertest(app)
          .get(`/api/users/?${qs}`)
          .set({ Authorization: `Bearer ${authToken}` })
          .expect(200)
          .then(response => {
            const { data } = response.body;
            data.forEach((i, index) => {
              if (index < data.length - 2) {
                expect(data[index].full_name < data[index + 1].full_name).to.be
                  .true;
              }
            });
          });
      });
      it("GET /api/users responds with 200 and filters by role_id", async () => {
        await populateDB(db);

        let opts = { ...usersDefaultOptions, roleFilter: 2 };
        const qs = queryString.stringify(opts);
        await UsersService.getUsers(db, opts);

        return supertest(app)
          .get(`/api/users/?${qs}`)
          .set({ Authorization: `Bearer ${authToken}` })
          .expect(200)
          .then(response => {
            const { data } = response.body;
            data.forEach((i, index) => {
              if (index < data.length - 2) {
                expect(data[index].role_id === 2).to.be.true;
              }
            });
          });
      });
      it("Updates a user", async () => {
        await populateDB(db);
        let { projects, role, ...user } = await UsersService.getUserByID(db, 3);
        user.email = "destroysociety33@hotmail.com";
        user.phone = "703-724-9988";
        user.full_name = "Christine Oberlin";
        const body = {
          user
        };
        return supertest(app)
          .post(`/api/users/create`)
          .send(body)
          .set({ Authorization: `Bearer ${authToken}` })
          .then(r => JSON.parse(r.text))
          .then(async res => {
            "email full_name role_id phone inactive"
              .split(" ")
              .forEach(fieldName => {
                let v = res[fieldName];
                let v2 = user[fieldName];
                expect(v.toString()).to.equal(v2.toString());
              });
          });
      });
      it("Creates a user", async () => {
        await populateDB(db);
        let user= 
       { id:-1,
         email : "destroysociety33@hotmail.com",
        phone: "703-724-9988",
        full_name : "Christine Oberlin",
        role_id : 2,
        password : "Ihopethisworks1",
        inactive:false
        }
        const body = {
          user
        };
        return supertest(app)
          .post(`/api/users/create`)
          .set({ Authorization: `Bearer ${authToken}` })
          .send(body)
          .then(r => JSON.parse(r.text))
          .then(async res => {
            // const res = await ProjectService.getProjectByID(db, 1)
            "email full_name role_id phone inactive"
              .split(" ")
              .forEach(fieldName => {
                let v = res[fieldName];
                let v2 = user[fieldName];
                expect(v.toString()).to.equal(v2.toString());
              });
          });
      });
      it("Deletes a user", async () => {
        await populateDB(db);
        const idToRemove = 3;

        return supertest(app)
          .delete(`/api/users/id/${idToRemove}`)
          .set({ Authorization: `Bearer ${authToken}` })
          .expect(204)
          .then(
            supertest(app)
              .get(`/api/users/id/${idToRemove}`)
              .then(r => JSON.parse(r.text))
              .then(res => {
                expect(res.inactive === true).to.be.true
              })
          )

      });
    });
  });
})
