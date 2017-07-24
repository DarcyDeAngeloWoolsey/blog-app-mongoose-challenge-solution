const chai = require('chai');
const chaiHttp = require('chai-http');
const faker = require('faker');
const mongoose = require('mongoose');

const should = chai.should();

const {
    //does this need to match what is in models?
    BlogPost
} = require('../models');
const {
    app, runServer, closeServer
} = require('../server');
const {
    TEST_DATABASE_URL
} = require('../config');

chai.use(chaiHttp);

// seed data here. use faker if possible.
function seedBlogPostData() {
    console.info('seeding blog post data');
    const seedData = [];

    for (let i = 1; i <= 10; i++) {
        seedData.push(generateBlogPostData());
    }

    return BlogPost.insertMany(seedData);
}

// in the restaurant version we had some const to
//declare some values that can be used to create
//fake data for borough, cuisine, ect. Seems that
//is not necessary for getting options for name and
//lorem. https://www.npmjs.com/package/Faker




// generate faked data
function generateBlogPostData() {
    return {
        author: {
            firstName: faker.name.firstName(),
            lastName: faker.name.lastName(),
        },
        //I guess lorem is to tell faker  to just make some lorem ipsum text. https://www.npmjs.com/package/Faker
        title: faker.lorem.sentence(),
        content: faker.lorem.text(),
    }
}


// this function deletes the entire database.
// we'll call it in an `afterEach` block below
function tearDownDb() {
    console.warn('Deleting database');
    return mongoose.connection.dropDatabase();
}

describe('Blogs API resource', function () {

    // these hook functions all return a promise with a value
    before(function () {
        return runServer(TEST_DATABASE_URL);
    });

    beforeEach(function () {
        return seedBlogPostData();
    });

    afterEach(function () {
        return tearDownDb();
    });

    after(function () {
        return closeServer();
    })

    // nested blocks to  make it cleaner
    //we are checking there is at least one entery, then we get the count and return it. Then we make sure it has the right fields/keys.
    describe('GET endpoint', function () {

        it('should return all existing blogs', function () {
            //I have my endpoints matching what is in server.js. Is that necessary?
            let res;
            return chai.request(app)
                .get('/posts')
                .then(function (_res) {
                    // so subsequent .then blocks can access resp obj.
                    res = _res;
                    res.should.have.status(200);
                    //                    console.log(res.body)
                    // is this to match the endpoint?
                    res.body.should.have.length.of.at.least(1);
                    return BlogPost.count();
                })
                .then(function (count) {
                    res.body.should.have.length.of(count);
                });
        });


        it('should return blogs with right fields', function () {


            let resBlog;
            return chai.request(app)
                .get('/posts')
                .then(function (res) {
                    res.should.have.status(200);
                    res.should.be.json;
                    //                    console.log(res.body);
                    res.body.should.be.a('array');
                    res.body.should.have.length.of.at.least(1);

                    res.body.forEach(function (posts) {
                        posts.should.be.a('object');
                        posts.should.include.keys(
                            'id', 'author', 'title', 'content', 'created');
                    });
                    resBlog = res.body[0];
                    return BlogPost.findById(resBlog.id);
                })
                .then(function (post) {
                    const blogPostApiRepr = post.apiRepr()
                        //in the solution they do not check id, but in the resturants one they do. Why?
                        // TODO: check why IDs are string and number                   resBlog.id.should.be(blogPostApiRepr.id);
                    console.log(resBlog, post.apiRepr())
                        // TODO: in the solutions it says posts.authorName. Why?
                    resBlog.author.should.equal(blogPostApiRepr.author);
                    resBlog.title.should.equal(blogPostApiRepr.title);
                    resBlog.content.should.equal(blogPostApiRepr.content);
                });
        });
    });

    //Post new data. Prove the right keys and an id are there.
    describe('POST endpoint', function () {

        it('should add a new blog post', function () {
            //in the example, instead of running the function, they right out a new object. Why?
            const newBlog = generateBlogPostData();

            return chai.request(app)
                .post('/posts')
                .send(newBlog)
                .then(function (res) {
                    console.log(res.body)
                    res.should.have.status(201);
                    res.should.be.json;
                    res.body.should.be.a('object');
                    res.body.should.include.keys(
                        'id', 'author', 'title', 'content', 'created');
                    res.body.title.should.equal(newBlog.title);
                    // check to see if id is there...
                    res.body.id.should.not.be.null;
                    res.body.author.should.equal(`${newBlog.author.firstName} ${newBlog.author.lastName}`);
                    res.body.content.should.equal(newBlog.content);
                    //we don't check created because we don't post created.
                    return BlogPost.findById(res.body.id);
                })
                .then(function (posts) {
                    posts.author.firstName.should.equal(newBlog.author.firstName);
                    posts.author.lastName.should.equal(newBlog.author.lastName);
                    posts.title.should.equal(newBlog.title);
                    posts.content.should.equal(newBlog.content);
                });
        });
    });

    describe('PUT endpoint', function () {
        //get a blog by id, rewuest to update, prove it contains data we sent, prove it is updated correctly

        it('should update fields you send over', function () {
            const updateData = {
                title: 'my dad',
                content: 'I never thought my reunion would be like this.',
                author: {
                    firstName: 'Luke',
                    lastName: 'Skywalker'
                }
            };

            return BlogPost
                .findOne()
                .exec()
                .then(function (posts) {
                    updateData.id = posts.id;

                    // make request then inspect it to make sure it reflects
                    // data we sent
                    return chai.request(app)
                        .put(`/posts/${posts.id}`)
                        .send(updateData);
                })
                .then(function (res) {
                    res.should.have.status(204);

                    return BlogPost.findById(updateData.id).exec();
                })
                .then(function (post) {
                    post.title.should.equal(updateData.title);
                    post.content.should.equal(updateData.content);
                    post.author.firstName.should.equal(updateData.author.firstName);
                    post.author.lastName.should.equal(updateData.author.lastName);
                });
        });
    });

    describe('DELETE endpoint', function () {
        // get a blogpost by id, request to delete it, check to make sure id is no longer there.
        it('delete a post by id', function () {

            let post;

            return BlogPost
                .findOne()
                .exec()
                .then(function (_post) {
                    post = _post;
                    return chai.request(app).delete(`/posts/${_post.id}`);
                })
                .then(function (res) {
                    res.should.have.status(204);
                    return BlogPost.findById(post.id).exec();
                })
                .then(function (_post) {
                    // when a variable's value is null, chaining `should`
                    // doesn't work. so `_post.should.be.null` would raise
                    // an error. `should.be.null(_post)` is how we can
                    // make assertions about a null value.
                    should.not.exist(_post);
                });
        });
    });
});
