"""
API Blueprints
Modular route organization for Reverie House API
"""

from flask import Blueprint

def register_blueprints(app):
    """Register all API blueprints with the Flask app"""
    from .routes import admin_routes, dreamer_routes, auth_routes, pigeons_routes, notifications_routes, invite_routes, util_routes, messages_routes, courier_routes, post_routes
    
    # Register blueprints
    app.register_blueprint(admin_routes.bp)
    app.register_blueprint(dreamer_routes.bp)
    app.register_blueprint(auth_routes.bp)
    app.register_blueprint(pigeons_routes.bp)
    app.register_blueprint(notifications_routes.notifications_bp, url_prefix='/api')
    app.register_blueprint(invite_routes.invite_bp)
    app.register_blueprint(util_routes.bp)
    app.register_blueprint(messages_routes.bp)
    app.register_blueprint(courier_routes.bp)
    app.register_blueprint(post_routes.bp)
    
    print("✅ API Blueprints registered")
