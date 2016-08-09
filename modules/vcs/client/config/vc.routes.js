'use strict';
// =========================================================================
//
// vc routes
//
// =========================================================================
angular.module('core').config(['$stateProvider', function ($stateProvider) {
	$stateProvider
	// -------------------------------------------------------------------------
	//
	// this is the abstract, top level view for vcs.
	// since it is a child of p (project), the project injection has already
	// been resolved and is available to subsequent child states as 'project'
	// here we will resolve the list of vcs for this project, which will
	// also become available to child states as 'vcs'
	//
	// -------------------------------------------------------------------------
	.state('p.vc', {
		abstract:true,
		url: '/vc',
		template: '<ui-view></ui-view>',
		resolve: {
			vcs: function ($stateParams, VcModel, ArtifactModel, project, ENV, _) {
				// console.log ('vc abstract resolving vcs');
				// console.log ('project id = ', project._id);
				// if (ENV === 'EAO')
				// 	// In EAO, they are artifacts - nothing for MEM right now so leave it.
				// 	return ArtifactModel.forProjectGetType (project._id, "valued-component");
				// else

				// This runs the populate for artifact, since it's been broken.
				return VcModel.forProject (project._id)
				.then( function (list) {
					_.each(list, function (item) {
						ArtifactModel.lookup(item.artifact)
						.then( function (art) {
							item.artifact = art;
						});
					});
					return list;
				});
			}
		}
	})
	// -------------------------------------------------------------------------
	//
	// the list state for vcs and project are guaranteed to
	// already be resolved
	//
	// -------------------------------------------------------------------------
	.state('p.vc.list', {
		url: '/list',
		templateUrl: 'modules/vcs/client/views/vc-list.html',
		controller: function ($scope, NgTableParams, vcs, project, $modal, $state, Authentication) {
			$scope.tableParams = new NgTableParams ({count:10}, {dataset: vcs});
			$scope.project = project;
			$scope.authentication = Authentication;
			$scope.openAddTopic = function() {
				var modalDocView = $modal.open({
					animation: true,
					templateUrl: 'modules/vcs/client/views/topic-modal-select.html',
					controller: 'controllerAddTopicModal',
					controllerAs: 'self',
					scope: $scope,
					size: 'lg'
				});
				modalDocView.result.then(function (res) {
					// console.log("res",res);
					$state.transitionTo('p.vc.list', {projectid:project.code}, {
			  			reload: true, inherit: false, notify: true
					});
				}, function () {
					//console.log("err");
				});
			};
		}
	})
	// -------------------------------------------------------------------------
	//
	// this is the add, or create state. it is defined before the others so that
	// it does not conflict
	//
	// -------------------------------------------------------------------------
	.state('p.vc.create', {
		url: '/create',
		templateUrl: 'modules/vcs/client/views/vc-edit.html',
		resolve: {
			vc: function (VcModel) {
				return VcModel.getNew ();
			}
		},
		controller: function ($scope, $state, project, vc, VcModel) {
			$scope.vc = vc;
			$scope.project = project;
			$scope.save = function () {
				VcModel.add ($scope.vc)
				.then (function (model) {
					$state.transitionTo('p.vc.list', {projectid:project.code}, {
			  			reload: true, inherit: false, notify: true
					});
				})
				.catch (function (err) {
					console.error (err);
					// alert (err.message);
				});
			};
		}
	})
	// -------------------------------------------------------------------------
	//
	// this is the edit state
	//
	// -------------------------------------------------------------------------
	.state('p.vc.edit', {
		url: '/:vcId/edit',
		templateUrl: 'modules/vcs/client/views/vc-edit.html',
		resolve: {
			vc: function ($stateParams, VcModel) {
				console.log ('editing vcId = ', $stateParams.vcId);
				return VcModel.getModel ($stateParams.vcId);
			},
			vcs: function ($stateParams, VcModel, vc) {
				// A list of all VC's for this project.
				return VcModel.forProject (vc.project);
			},
			art: function ($stateParams, ArtifactModel, vc) {
				return ArtifactModel.lookup(vc.artifact);
			},
			vclist: function ($stateParams, VcModel, vc) {
				// A list of already selected/added vc's
				return VcModel.getVCsInList(vc.subComponents);
			},
			canDeleteVc: function($stateParams, VcModel, vc) {
				return VcModel.deleteCheck (vc._id);
			}
		},
		controller: function ($scope, $state, vc, canDeleteVc, project, VcModel, PILLARS, TopicModel, art, ArtifactModel, _, vclist, vcs, VCTYPES, $modal) {
			// console.log ('vc = ', vc);
			$scope.vc = vc;
			
			$scope.canPublish = vc.userCan.publish && !vc.isPublished;
			$scope.canUnpublish = vc.userCan.unPublish && vc.isPublished;
			// disable the delete button if user doesn't have permission to delete, or the vc is published, or it has related data...
			$scope.canDelete = vc.userCan.delete && !vc.isPublished && canDeleteVc.canDelete;
			
			$scope.vclist = vclist;
			$scope.vcs = vcs;
			$scope.vc.artifact = art;
			$scope.vc.artifact.document = ($scope.vc.artifact.document) ? $scope.vc.artifact.document : {};
			$scope.vc.artifact.maindocument = $scope.vc.artifact.document._id ? [$scope.vc.artifact.document._id] : [];
			$scope.project = project;
			$scope.pillars = PILLARS;
			$scope.types = VCTYPES;

			$scope.selectTopic = function () {
				var self = this;
				TopicModel.getTopicsForPillar (this.vc.pillar).then (function (topics) {
					self.topics = topics;
					$scope.$apply();
				});
			};

			$scope.showError = function(msg, errorList, title) {
				var modalDocView = $modal.open({
					animation: true,
					templateUrl: 'modules/vcs/client/views/vc-modal-error.html',
					controller: function($scope, $state, $modalInstance, _) {
						var self = this;
						self.vc = $scope.vc;
						self.title = title || 'An error has occurred';
						self.msg = msg;
						self.errors = errorList;
						self.ok = function() {
							$modalInstance.close(vc);
						};
						self.cancel = function() {
							$modalInstance.dismiss('cancel');
						};
					},
					controllerAs: 'self',
					scope: $scope,
					size: 'lg'
				});
				modalDocView.result.then(function (res) {
					// don't really need to do anything...
				}, function (err) {
					//console.log('showError modal error = ',  JSON.stringify(err));
				});
			};

			$scope.showSuccess = function(msg, goToList, title) {
				var modalDocView = $modal.open({
					animation: true,
					templateUrl: 'modules/vcs/client/views/vc-modal-success.html',
					controller: function($scope, $state, $modalInstance, _) {
						var self = this;
						self.vc = $scope.vc;
						self.title = title || 'Success';
						self.msg = msg;
						self.ok = function() {
							$modalInstance.close(vc);
						};
						self.cancel = function() {
							$modalInstance.dismiss('cancel');
						};
					},
					controllerAs: 'self',
					scope: $scope,
					size: 'lg'
				});
				modalDocView.result.then(function (res) {
					if (goToList) {
						$state.transitionTo('p.vc.list', {projectid: $scope.project.code}, {
							reload: true, inherit: false, notify: true
						});
					} else {
						$state.reload();
					}
				}, function (err) {
					//console.log('showSuccess modal error = ',  JSON.stringify(err));
				});
			};

			$scope.delete = function() {
				var modalDocView = $modal.open({
					animation: true,
					templateUrl: 'modules/vcs/client/views/vc-modal-confirm-delete.html',
					controller: function($scope, $state, $modalInstance, VcModel, _) {
						var self = this;
						self.vc = $scope.vc;
						self.ok = function() {
							$modalInstance.close(vc);
						};
						self.cancel = function() {
							$modalInstance.dismiss('cancel');
						};
					},
					controllerAs: 'self',
					scope: $scope,
					size: 'lg'
				});
				modalDocView.result.then(function (res) {
					VcModel.deleteId($scope.vc._id)
						.then(function(res) {
							// deleted show the message, and go to list...
							$scope.showSuccess($scope.vc.name + ' was deleted successfully', true, 'Delete Success');
						})
						.catch(function(res) {
							// could have errors from a delete check...
							var failure = _.has(res, 'message') ? res.message : undefined;
							if (failure) {
								var errorList = [];
								if (failure.comments && failure.comments.length > 0) {
									errorList.push({msg: 'Has ' + failure.comments.length + ' related comments.'});
								}
								if (failure.artifacts && failure.artifacts.length > 0) {
									errorList.push({msg: 'Has ' + failure.artifacts.length + ' related Content.'});
								}
								if (failure.vcs && failure.vcs.length > 0) {
									errorList.push({msg: 'Has ' + failure.vcs.length + ' related Valued Components.'});
								}
								$scope.showError($scope.vc.name + ' cannot be deleted.', errorList, 'Delete Error');
							} else {
								$scope.showError($scope.vc.name + ' was not deleted.', [], 'Delete Error');
							}
						});
				}, function () {
					//console.log('delete modalDocView error');
				});
			};
			$scope.publish = function() {
				var modalDocView = $modal.open({
					animation: true,
					templateUrl: 'modules/vcs/client/views/vc-modal-confirm-publish.html',
					controller: function($scope, $state, $modalInstance, VcModel, _) {
						var self = this;
						self.vc = $scope.vc;
						self.ok = function() {
							$modalInstance.close(vc);
						};
						self.cancel = function() {
							$modalInstance.dismiss('cancel');
						};
					},
					controllerAs: 'self',
					scope: $scope,
					size: 'lg'
				});
				modalDocView.result.then(function (res) {
					VcModel.publish ($scope.vc._id)
						.then(function(res) {
							$scope.showSuccess($scope.vc.name + ' was published successfully', false, 'Publish Success');
						})
						.catch(function(res) {
							$scope.showError($scope.vc.name + ' was not published.', [], 'Delete Error');
						});
				}, function () {
					//console.log('publish modalDocView error');
				});
			};
			$scope.unpublish = function() {
				VcModel.unpublish ($scope.vc._id)
					.then(function(res) {
						$scope.showSuccess($scope.vc.name + ' was unpublished successfully', false, 'Unpublish Success');
					})
					.catch(function(res) {
						$scope.showError($scope.vc.name + ' is still published.', [], 'Unpublish Error');
					});
				};

			$scope.save = function () {
				vc.artifact.document = vc.artifact.maindocument[0];
				if (_.isEmpty (vc.artifact.document)) vc.artifact.document = null;
				ArtifactModel.save($scope.vc.artifact)
				.then (function () {
					return VcModel.save ($scope.vc);
				})
				.then (function (res) {
					$scope.showSuccess($scope.vc.name + ' was saved successfully', false, 'Save Success');
				})
				.catch (function (err) {
					$scope.showError($scope.vc.name + ' was not saved.', [], 'Save Error');
				});
			};

			$scope.$on('cleanup', function () {
				$state.go('p.vc.detail', {
						projectid:$scope.project.code,
						vcId: $scope.vc._id
					}, {
					reload: true, inherit: false, notify: true
				});
			});
		}
	})
	// -------------------------------------------------------------------------
	//
	// this is the 'view' mode of a vc. here we are just simply
	// looking at the information for this specific object
	//
	// -------------------------------------------------------------------------
	.state('p.vc.detail', {
		url: '/:vcId',
		templateUrl: 'modules/vcs/client/views/vc-view.html',
		resolve: {
			vc: function ($stateParams, VcModel) {
				// console.log ('vcId = ', $stateParams.vcId);
				return VcModel.getModel ($stateParams.vcId);
			},
			art: function ($stateParams, ArtifactModel, vc) {
				return ArtifactModel.lookup(vc.artifact);
			},
			vclist: function ($stateParams, VcModel, vc) {
				return VcModel.getVCsInList(vc.subComponents);
			}
		},
		controller: function ($scope, vc, project, art, vclist) {
			// console.log ('vc = ', vc);
			$scope.vc = vc;
			$scope.vclist = vclist;
			$scope.vc.artifact = art;
			$scope.project = project;
		}
	})

	;

}]);

